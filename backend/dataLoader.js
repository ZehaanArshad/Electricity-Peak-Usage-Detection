/**
 * dataLoader.js
 * Streams and aggregates the large cleaned_data.csv in a single pass.
 * Stores pre-computed aggregations in memory to serve dashboard API endpoints fast.
 */

const fs   = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

const DATA_PATH  = path.join(__dirname, '../data/cleaned/cleaned_data.csv');
const SAMPLE_RATE = 26; // keep ~1 row every 26 → ~5 100 sample points from 132 k rows

// ─── Loading status (polled by /api/loading-status) ──────────────────────────
const loadingStatus = {
  phase       : 'idle',   // idle | loading | ready | error
  rowsLoaded  : 0,
  estimated   : 132922,
  pct         : 0,
  error       : null,
  startedAt   : null,
  finishedAt  : null,
  elapsedSec  : null,
};

// ─── In-memory store (populated during loadData()) ───────────────────────────
const store = {};

let isLoaded    = false;
let loadPromise = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDayKey(dt) {
  return dt.toISOString().slice(0, 10);          // "YYYY-MM-DD"
}

function getMonthKey(dt) {
  return dt.toISOString().slice(0, 7);           // "YYYY-MM"
}

// ─── Main load function ───────────────────────────────────────────────────────
async function loadData() {
  if (isLoaded)    return store;
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const t0 = Date.now();
    loadingStatus.phase     = 'loading';
    loadingStatus.startedAt = new Date().toISOString();

    let headers = null;
    let numMeters = 0;
    let rowIdx = 0;

    // ── Aggregation buffers (allocated after header row is read) ──────────────
    let hourlySum, hourlyCnt;          // [hour]  Float64Array / Int32Array
    let monthlySum, monthlyCnt;        // [month]
    let dowHourSum, dowHourCnt;        // [dow][hour]  total load across all meters
    let meterSum, meterSumSq, meterCnt, meterMax, meterMin;

    // Daily averages per meter – stored as Map<"YYYY-MM-DD", Float64Array>
    const meterDailySum = new Map();
    const meterDailyCnt = new Map();

    // Sampled full rows for per-meter time-series / peak detection
    const sampledTimestamps = [];
    const sampledValues     = [];      // [sampleIdx] = Float32Array[numMeters]

    // Total load (sum over all meters) for every row
    const totalLoadSeries   = [];      // [{ dt: string, v: number }]

    // ── Initialise structures once numMeters is known ─────────────────────────
    function init(nm) {
      numMeters  = nm;

      hourlySum  = Array.from({ length: 24 }, () => new Float64Array(nm));
      hourlyCnt  = new Int32Array(24);

      monthlySum = Array.from({ length: 12 }, () => new Float64Array(nm));
      monthlyCnt = new Int32Array(12);

      dowHourSum = Array.from({ length: 7 }, () => new Float64Array(24));
      dowHourCnt = Array.from({ length: 7 }, () => new Int32Array(24));

      meterSum   = new Float64Array(nm);
      meterSumSq = new Float64Array(nm);
      meterCnt   = new Int32Array(nm);
      meterMax   = new Float64Array(nm).fill(-Infinity);
      meterMin   = new Float64Array(nm).fill(Infinity);
    }

    // ── Stream the CSV ────────────────────────────────────────────────────────
    const parser = fs.createReadStream(DATA_PATH)
      .pipe(parse({ delimiter: ',', skip_empty_lines: true }));

    parser.on('data', (row) => {
      // ── Header row ──────────────────────────────────────────────────────────
      if (headers === null) {
        headers = row.slice(1);      // ['MT_001', 'MT_002', ...]
        init(headers.length);
        return;
      }

      // ── Data row ────────────────────────────────────────────────────────────
      const dtStr = row[0];
      const dt    = new Date(dtStr.replace(' ', 'T'));
      if (isNaN(dt.getTime())) return;

      const hour   = dt.getHours();
      const month  = dt.getMonth();   // 0–11
      const dow    = dt.getDay();     // 0=Sun … 6=Sat
      const dayKey = getDayKey(dt);

      hourlyCnt[hour]++;
      monthlyCnt[month]++;
      dowHourCnt[dow][hour]++;

      // Ensure daily map entries exist
      if (!meterDailySum.has(dayKey)) {
        meterDailySum.set(dayKey, new Float64Array(numMeters));
        meterDailyCnt.set(dayKey, new Int32Array(numMeters));
      }
      const daySum = meterDailySum.get(dayKey);
      const dayCnt = meterDailyCnt.get(dayKey);

      const isSample  = (rowIdx % SAMPLE_RATE === 0);
      const sampleRow = isSample ? new Float32Array(numMeters) : null;

      let totalLoad = 0;

      for (let i = 1; i < row.length && i - 1 < numMeters; i++) {
        const mi  = i - 1;
        const val = parseFloat(row[i]) || 0;

        meterSum[mi]   += val;
        meterSumSq[mi] += val * val;
        meterCnt[mi]++;
        if (val > meterMax[mi]) meterMax[mi] = val;
        if (val < meterMin[mi]) meterMin[mi] = val;

        hourlySum[hour][mi]  += val;
        monthlySum[month][mi] += val;
        dowHourSum[dow][hour] += val;   // scalar aggregate — add once per meter

        daySum[mi] += val;
        dayCnt[mi]++;

        totalLoad += val;
        if (isSample) sampleRow[mi] = val;
      }

      // correct double-counting: dowHourSum accumulates total load (all meters)
      // but we added each meter individually inside the loop, which is correct
      // (one call per meter, so sum = total load for this timestamp)

      totalLoadSeries.push({ dt: dtStr, v: totalLoad });

      if (isSample) {
        sampledTimestamps.push(dtStr);
        sampledValues.push(sampleRow);
      }

      if (rowIdx === 0) {
        store.dateRange = { start: dtStr, end: dtStr };
      } else {
        store.dateRange.end = dtStr;
      }

      rowIdx++;
      loadingStatus.rowsLoaded = rowIdx;
      loadingStatus.pct        = Math.min(99, Math.round((rowIdx / loadingStatus.estimated) * 100));

      if (rowIdx % 20000 === 0) {
        const sec = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`  ⏳ ${rowIdx.toLocaleString()} rows processed … (${sec}s)`);
      }
    });

    // ── Finalise ──────────────────────────────────────────────────────────────
    parser.on('end', () => {
      store.meters    = headers;
      store.totalRows = rowIdx;
      store.numMeters = numMeters;

      // ── Per-meter statistics ───────────────────────────────────────────────
      store.meterStats = headers.map((id, i) => {
        const cnt  = meterCnt[i] || 1;
        const mean = meterSum[i] / cnt;
        const variance = Math.max(0, (meterSumSq[i] / cnt) - mean * mean);
        return {
          id,
          mean  : +mean.toFixed(4),
          std   : +Math.sqrt(variance).toFixed(4),
          max   : meterMax[i] === -Infinity ? 0 : +meterMax[i].toFixed(4),
          min   : meterMin[i] ===  Infinity ? 0 : +meterMin[i].toFixed(4),
          total : +meterSum[i].toFixed(2),
          count : cnt,
        };
      });

      // ── Hourly profile (24-h load curve) ──────────────────────────────────
      store.hourlyProfile = Array.from({ length: 24 }, (_, h) => {
        const cnt      = hourlyCnt[h] || 1;
        const avgLoads = Array.from(hourlySum[h], v => +(v / cnt).toFixed(4));
        const totalAvg = +avgLoads.reduce((a, b) => a + b, 0).toFixed(4);
        return { hour: h, totalAvg, count: hourlyCnt[h] };
      });

      // ── Monthly profile ────────────────────────────────────────────────────
      store.monthlyProfile = Array.from({ length: 12 }, (_, m) => {
        const cnt      = monthlyCnt[m] || 1;
        const avgLoads = Array.from(monthlySum[m], v => +(v / cnt).toFixed(4));
        const totalAvg = +avgLoads.reduce((a, b) => a + b, 0).toFixed(4);
        return { month: m, name: MONTH_NAMES[m], totalAvg, count: monthlyCnt[m] };
      });

      // ── DoW × Hour heatmap ────────────────────────────────────────────────
      store.dowHourHeatmap = Array.from({ length: 7 }, (_, d) => ({
        day  : DOW_NAMES[d],
        hours: Array.from({ length: 24 }, (_, h) => ({
          hour   : h,
          avgLoad: dowHourCnt[d][h] > 0
            ? +(dowHourSum[d][h] / dowHourCnt[d][h]).toFixed(4)
            : 0,
          count  : dowHourCnt[d][h],
        })),
      }));

      // ── Sampled / full series ─────────────────────────────────────────────
      store.sampledTimestamps = sampledTimestamps;
      store.sampledValues     = sampledValues;
      store.totalLoadSeries   = totalLoadSeries;

      // ── Daily meter maps ──────────────────────────────────────────────────
      store.meterDailySum = meterDailySum;
      store.meterDailyCnt = meterDailyCnt;

      // ── Sorted daily keys ─────────────────────────────────────────────────
      store.sortedDayKeys = [...meterDailySum.keys()].sort();

      const elapsedSec = +((Date.now() - t0) / 1000).toFixed(1);
      loadingStatus.phase      = 'ready';
      loadingStatus.pct        = 100;
      loadingStatus.finishedAt = new Date().toISOString();
      loadingStatus.elapsedSec = elapsedSec;

      console.log(`\n✅ Loaded ${rowIdx.toLocaleString()} rows | ${numMeters} meters | ${elapsedSec}s`);
      isLoaded = true;
      resolve(store);
    });

    parser.on('error', (err) => {
      loadingStatus.phase = 'error';
      loadingStatus.error = err.message;
      reject(err);
    });
  });

  return loadPromise;
}

module.exports = {
  loadData,
  getData         : () => store,
  getLoadingStatus: () => loadingStatus,
};
