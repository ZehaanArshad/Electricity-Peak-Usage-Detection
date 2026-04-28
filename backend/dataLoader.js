const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { parse } = require('csv-parse');

// ── Paths ──────────────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, '../data/cleaned');
const DATA_PATH = path.join(DATA_DIR, 'cleaned_data.csv');

// ── In-memory store ────────────────────────────────────────────────────────────
let store = {
  isLoaded: false,
  error: null,
  meters: [],
  numMeters: 0,
  totalRows: 0,
  dateRange: { start: null, end: null },
  meterStats: [],
  hourlyProfile: [],
  monthlyProfile: [],
  dowHourHeatmap: [],
  totalLoadSeries: [],
  sampledRows: [],
  dailyMap: {},
  sortedDayKeys: []
};

// ── CSV Download helper ────────────────────────────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const gdMatch = url.match(
      /drive\.google\.com\/(?:file\/d\/|uc[?&].*?id=|open[?&]id=)([a-zA-Z0-9_-]{10,})/
    );
    if (gdMatch) {
      const fileId = gdMatch[1];
      url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
      console.log(`Google Drive detected → direct URL for ID: ${fileId}`);
    }

    const MAX_REDIRECTS = 10;

    function doRequest(requestUrl, redirectsLeft) {
      if (redirectsLeft < 0) return reject(new Error('Too many redirects while downloading CSV.'));

      const proto = requestUrl.startsWith('https') ? https : http;

      proto.get(requestUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, requestUrl).href;
          return doRequest(next, redirectsLeft - 1);
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }

        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            const idMatch = body.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
            const id = idMatch?.[1] || requestUrl.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)?.[1];
            if (id) {
              const retryUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
              return doRequest(retryUrl, redirectsLeft - 1);
            }
            reject(new Error('Received HTML instead of CSV. Ensure CSV_URL is a direct-download link.'));
          });
          return;
        }

        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', reject);
      }).on('error', reject);
    }

    doRequest(url, MAX_REDIRECTS);
  });
}

// ── Main loader ────────────────────────────────────────────────────────────────
async function loadData() {
  if (store.isLoaded) return store;
  store.error = null;

  try {
    if (!fs.existsSync(DATA_PATH)) {
      const csvUrl = process.env.CSV_URL;
      if (!csvUrl) {
        throw new Error('CSV not found locally and CSV_URL is not set.');
      }
      console.log('CSV not found locally. Downloading...');
      await downloadFile(csvUrl, DATA_PATH);
    }

    // Validate if it's actually a CSV and not HTML
    const fd = fs.openSync(DATA_PATH, 'r');
    const firstBytes = Buffer.alloc(20);
    fs.readSync(fd, firstBytes, 0, 20, 0);
    fs.closeSync(fd);
    if (firstBytes.toString().trimStart().startsWith('<')) {
      fs.unlinkSync(DATA_PATH);
      throw new Error('The downloaded file is HTML, not CSV. Check your CSV_URL.');
    }

    await parseCSV();
    store.isLoaded = true;
    return store;
  } catch (err) {
    store.error = err.message;
    throw err;
  }
}

// ── Efficient CSV Parsing ──────────────────────────────────────────────────────
function parseCSV() {
  return new Promise((resolve, reject) => {
    let headers = null;
    let rowCount = 0;

    // Intermediate aggregation structures
    let mStats = []; // { sum, sumSq, max, min, count }
    const hourlySum = Array(24).fill(0);
    const hourlyCnt = Array(24).fill(0);
    const monthlySum = Array(12).fill(0);
    const monthlyCnt = Array(12).fill(0);
    const dowHourSum = Array.from({ length: 7 }, () => Array(24).fill(0));
    const dowHourCnt = Array.from({ length: 7 }, () => Array(24).fill(0));
    const dailyMap = {};

    const parser = fs.createReadStream(DATA_PATH)
      .pipe(parse({ delimiter: ',', skip_empty_lines: true }));

    console.log('Parsing CSV and calculating statistics...');

    parser.on('data', (row) => {
      if (headers === null) {
        headers = row.slice(1);
        store.meters = headers;
        store.numMeters = headers.length;
        mStats = headers.map(() => ({ sum: 0, sumSq: 0, max: -Infinity, min: Infinity, count: 0 }));
        return;
      }

      const dt = new Date(row[0].replace(' ', 'T'));
      if (isNaN(dt.getTime())) return;

      const dtStr = row[0];
      const hour = dt.getHours();
      const month = dt.getMonth();
      const dow = dt.getDay();
      const dayKey = dtStr.slice(0, 10);

      if (!store.dateRange.start) store.dateRange.start = dtStr;
      store.dateRange.end = dtStr;

      const numMeters = headers.length;
      let rowTotal = 0;
      const values = new Float32Array(numMeters);

      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { sum: new Float32Array(numMeters), cnt: new Uint16Array(numMeters) };
      }

      for (let i = 0; i < numMeters; i++) {
        const val = parseFloat(row[i + 1]) || 0;
        values[i] = val;
        rowTotal += val;

        // Update stats
        const s = mStats[i];
        s.sum += val;
        s.sumSq += val * val;
        if (val > s.max) s.max = val;
        if (val < s.min) s.min = val;
        s.count++;

        // Update daily
        dailyMap[dayKey].sum[i] += val;
        dailyMap[dayKey].cnt[i]++;
      }

      // Update profiles
      hourlySum[hour] += rowTotal;
      hourlyCnt[hour]++;
      monthlySum[month] += rowTotal;
      monthlyCnt[month]++;
      dowHourSum[dow][hour] += rowTotal;
      dowHourCnt[dow][hour]++;

      // Sampling (approx every 6.5 hours if 15min grain, 26 * 15 = 390 min)
      if (rowCount % 26 === 0) {
        store.sampledRows.push({ dt, dtStr, values });
        store.totalLoadSeries.push({ dt: dtStr, v: +rowTotal.toFixed(4) });
      }

      rowCount++;
      if (rowCount % 20000 === 0) {
        process.stdout.write(`\rProcessed ${rowCount} rows...`);
      }
    });

    parser.on('end', () => {
      console.log(`\nFinished parsing ${rowCount} rows.`);
      store.totalRows = rowCount;

      // Finalize Stats
      store.meterStats = headers.map((id, i) => {
        const s = mStats[i];
        const mean = s.sum / s.count;
        const std = Math.sqrt(Math.max(0, (s.sumSq / s.count) - (mean * mean)));
        return {
          id,
          mean: +mean.toFixed(4),
          std: +std.toFixed(4),
          max: +s.max.toFixed(4),
          min: +s.min.toFixed(4),
          total: +s.sum.toFixed(2),
          count: s.count
        };
      });

      // Finalize Profiles
      store.hourlyProfile = hourlySum.map((sum, hour) => ({
        hour,
        totalAvg: +(sum / (hourlyCnt[hour] || 1)).toFixed(4),
        count: hourlyCnt[hour]
      }));

      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      store.monthlyProfile = monthlySum.map((sum, month) => ({
        month,
        name: monthNames[month],
        totalAvg: +(sum / (monthlyCnt[month] || 1)).toFixed(4),
        count: monthlyCnt[month]
      }));

      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      store.dowHourHeatmap = dayNames.map((day, d) => ({
        day,
        hours: Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          avgLoad: dowHourCnt[d][h] > 0 ? +(dowHourSum[d][h] / dowHourCnt[d][h]).toFixed(4) : 0,
          count: dowHourCnt[d][h]
        }))
      }));

      store.dailyMap = dailyMap;
      store.sortedDayKeys = Object.keys(dailyMap).sort();

      resolve(store);
    });

    parser.on('error', reject);
  });
}

module.exports = {
  loadData,
  getData: () => store
};
