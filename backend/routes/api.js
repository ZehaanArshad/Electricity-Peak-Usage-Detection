/**
 * routes/api.js
 * All REST endpoints for the Electricity Peak Detection dashboard.
 */

const express = require('express');
const router  = express.Router();
const { getData, getLoadingStatus } = require('../dataLoader');

// ─── Guard helper ─────────────────────────────────────────────────────────────
function requireData(res) {
  const d = getData();
  if (!d.meters) {
    res.status(503).json({
      error  : 'Data is still loading. Poll /api/loading-status for progress.',
      status : getLoadingStatus(),
    });
    return null;
  }
  return d;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/loading-status  — always responds (no guard)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/loading-status', (req, res) => {
  res.json(getLoadingStatus());
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/health
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/health', (req, res) => {
  const d = getData();
  res.json({
    status    : d.meters ? 'ready' : 'loading',
    totalRows : d.totalRows  || 0,
    numMeters : d.numMeters  || 0,
    dateRange : d.dateRange  || null,
    loading   : getLoadingStatus(),
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/summary  — high-level KPIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/summary', (req, res) => {
  const d = requireData(res); if (!d) return;

  const totalConsumption     = d.meterStats.reduce((s, m) => s + m.total, 0);
  const avgConsumptionPerMeter = totalConsumption / d.numMeters;

  const maxConsumer = d.meterStats.reduce((a, b) => a.total > b.total ? a : b);
  const minConsumer = d.meterStats.reduce((a, b) => a.total < b.total ? a : b);

  const peakHour = d.hourlyProfile.reduce((a, b) => a.totalAvg > b.totalAvg ? a : b);
  const peakDay  = d.dowHourHeatmap.reduce((a, b) => {
    const sumA = a.hours.reduce((s, h) => s + h.avgLoad, 0);
    const sumB = b.hours.reduce((s, h) => s + h.avgLoad, 0);
    return sumA > sumB ? a : b;
  });

  res.json({
    totalRows            : d.totalRows,
    numMeters            : d.numMeters,
    dateRange            : d.dateRange,
    totalConsumption     : +totalConsumption.toFixed(2),
    avgConsumptionPerMeter: +avgConsumptionPerMeter.toFixed(4),
    maxConsumer          : { id: maxConsumer.id, total: maxConsumer.total },
    minConsumer          : { id: minConsumer.id, total: minConsumer.total },
    peakHour             : peakHour.hour,
    peakDay              : peakDay.day,
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/meters  — list all meter IDs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/meters', (req, res) => {
  const d = requireData(res); if (!d) return;
  res.json({ count: d.meters.length, meters: d.meters });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/meter-stats?sort=total&order=desc&limit=20
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/meter-stats', (req, res) => {
  const d = requireData(res); if (!d) return;

  const { sort = 'total', order = 'desc', limit = '370', search = '' } = req.query;
  let stats = [...d.meterStats];

  // Optional ID search
  if (search) {
    const q = search.toUpperCase();
    stats = stats.filter(m => m.id.toUpperCase().includes(q));
  }

  // Sort
  const validSorts = ['total','mean','std','max','min','id'];
  const sortKey    = validSorts.includes(sort) ? sort : 'total';
  stats.sort((a, b) => {
    if (sortKey === 'id') return order === 'desc'
      ? b.id.localeCompare(a.id)
      : a.id.localeCompare(b.id);
    return order === 'desc'
      ? (b[sortKey] || 0) - (a[sortKey] || 0)
      : (a[sortKey] || 0) - (b[sortKey] || 0);
  });

  res.json({ total: stats.length, stats: stats.slice(0, parseInt(limit)) });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/daily-load-curve  — 24-hour average load profile
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/daily-load-curve', (req, res) => {
  const d = requireData(res); if (!d) return;
  res.json({ profile: d.hourlyProfile });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/monthly-trends
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/monthly-trends', (req, res) => {
  const d = requireData(res); if (!d) return;
  res.json({ trends: d.monthlyProfile });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/heatmap  — Day-of-week × Hour aggregate heatmap
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/heatmap', (req, res) => {
  const d = requireData(res); if (!d) return;
  res.json({ heatmap: d.dowHourHeatmap });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/top-consumers?limit=10
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/top-consumers', (req, res) => {
  const d = requireData(res); if (!d) return;
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const sorted = [...d.meterStats].sort((a, b) => b.total - a.total);
  res.json({ topConsumers: sorted.slice(0, limit) });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/total-load-series?sample=500
// Returns the total (all meters summed) load time series, down-sampled.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/total-load-series', (req, res) => {
  const d = requireData(res); if (!d) return;

  const sample = Math.min(parseInt(req.query.sample) || 1000, 5000);
  const full   = d.totalLoadSeries;
  const step   = Math.max(1, Math.floor(full.length / sample));
  const series = full
    .filter((_, i) => i % step === 0)
    .map(r => ({ datetime: r.dt, totalLoad: +r.v.toFixed(4) }));

  res.json({ total: full.length, returned: series.length, series });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/meter-timeseries?meter=MT_001&resolution=daily|monthly
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/meter-timeseries', (req, res) => {
  const d = requireData(res); if (!d) return;

  const { meter, resolution = 'daily' } = req.query;
  if (!meter) return res.status(400).json({ error: 'Query param ?meter= is required.' });

  const meterIdx = d.meters.indexOf(meter);
  if (meterIdx === -1) return res.status(404).json({ error: `Meter "${meter}" not found.` });

  const result = [];

  if (resolution === 'daily') {
    for (const dayKey of d.sortedDayKeys) {
      const sumArr = d.meterDailySum.get(dayKey);
      const cntArr = d.meterDailyCnt.get(dayKey);
      const cnt    = cntArr[meterIdx];
      result.push({
        date     : dayKey,
        avgLoad  : cnt > 0 ? +(sumArr[meterIdx] / cnt).toFixed(4) : 0,
        totalLoad: +sumArr[meterIdx].toFixed(4),
      });
    }
  } else if (resolution === 'monthly') {
    const monthMap = new Map();
    for (const dayKey of d.sortedDayKeys) {
      const monthKey = dayKey.slice(0, 7);
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { sum: 0, cnt: 0 });
      const e      = monthMap.get(monthKey);
      const sumArr = d.meterDailySum.get(dayKey);
      const cntArr = d.meterDailyCnt.get(dayKey);
      e.sum += sumArr[meterIdx];
      e.cnt += cntArr[meterIdx];
    }
    for (const [monthKey, { sum, cnt }] of [...monthMap.entries()].sort()) {
      result.push({
        date     : monthKey,
        avgLoad  : cnt > 0 ? +(sum / cnt).toFixed(4) : 0,
        totalLoad: +sum.toFixed(4),
      });
    }
  } else {
    return res.status(400).json({ error: 'resolution must be "daily" or "monthly".' });
  }

  res.json({ meter, resolution, count: result.length, series: result });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/peak-detection?threshold=2.0&meter=ALL&limit=200
//   threshold: z-score multiplier (default 2.0 = mean + 2*std)
//   meter    : specific meter ID, or ALL (default)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/peak-detection', (req, res) => {
  const d = requireData(res); if (!d) return;

  const threshold  = parseFloat(req.query.threshold) || 2.0;
  const meterParam = (req.query.meter || 'ALL').toUpperCase();
  const limit      = Math.min(parseInt(req.query.limit) || 200, 2000);

  const peaks = [];

  const processMeter = (mi) => {
    const stat        = d.meterStats[mi];
    const peakCutoff  = stat.mean + threshold * stat.std;
    for (let si = 0; si < d.sampledTimestamps.length; si++) {
      const val = d.sampledValues[si][mi];
      if (val > peakCutoff) {
        peaks.push({
          datetime: d.sampledTimestamps[si],
          meter   : d.meters[mi],
          value   : +val.toFixed(4),
          zscore  : stat.std > 0 ? +((val - stat.mean) / stat.std).toFixed(3) : 0,
          threshold: +peakCutoff.toFixed(4),
        });
      }
    }
  };

  if (meterParam === 'ALL') {
    for (let mi = 0; mi < d.numMeters; mi++) processMeter(mi);
  } else {
    const mi = d.meters.indexOf(meterParam);
    if (mi === -1) return res.status(404).json({ error: `Meter "${meterParam}" not found.` });
    processMeter(mi);
  }

  peaks.sort((a, b) => b.zscore - a.zscore);

  res.json({
    meter       : meterParam,
    threshold,
    totalPeaks  : peaks.length,
    returned    : Math.min(peaks.length, limit),
    peaks       : peaks.slice(0, limit),
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/distribution?meter=MT_001&bins=30
//   Computes a histogram of load values from the sampled dataset.
//   Omit meter to get the distribution of total load (across all meters).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/distribution', (req, res) => {
  const d = requireData(res); if (!d) return;

  const { meter, bins = '30' } = req.query;
  const binCount = Math.min(Math.max(parseInt(bins) || 30, 5), 200);

  let values;
  if (meter) {
    const mi = d.meters.indexOf(meter);
    if (mi === -1) return res.status(404).json({ error: `Meter "${meter}" not found.` });
    values = d.sampledValues.map(row => row[mi]);
  } else {
    values = d.sampledValues.map(row => {
      let sum = 0;
      for (let i = 0; i < row.length; i++) sum += row[i];
      return sum;
    });
  }

  const nonZero = values.filter(v => v > 0);
  if (nonZero.length === 0) return res.json({ bins: [], stats: {} });

  nonZero.sort((a, b) => a - b);
  const minVal  = nonZero[0];
  const maxVal  = nonZero[nonZero.length - 1];
  const binWidth = (maxVal - minVal) / binCount || 1;

  const histogram = Array.from({ length: binCount }, (_, i) => ({
    binStart: +(minVal + i * binWidth).toFixed(4),
    binEnd  : +(minVal + (i + 1) * binWidth).toFixed(4),
    count   : 0,
  }));

  for (const v of nonZero) {
    const idx = Math.min(binCount - 1, Math.floor((v - minVal) / binWidth));
    histogram[idx].count++;
  }

  const mean     = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  const variance = nonZero.reduce((s, v) => s + (v - mean) ** 2, 0) / nonZero.length;
  const pct      = (p) => nonZero[Math.floor(nonZero.length * p)];

  res.json({
    meter: meter || 'ALL',
    bins : histogram,
    stats: {
      mean : +mean.toFixed(4),
      std  : +Math.sqrt(variance).toFixed(4),
      min  : +minVal.toFixed(4),
      max  : +maxVal.toFixed(4),
      count: nonZero.length,
      p25  : +pct(0.25).toFixed(4),
      p50  : +pct(0.50).toFixed(4),
      p75  : +pct(0.75).toFixed(4),
      p90  : +pct(0.90).toFixed(4),
      p95  : +pct(0.95).toFixed(4),
    },
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/compare-meters?meters=MT_001,MT_002,MT_003&resolution=monthly
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/compare-meters', (req, res) => {
  const d = requireData(res); if (!d) return;

  const { meters, resolution = 'monthly' } = req.query;
  if (!meters) return res.status(400).json({ error: '?meters=MT_001,MT_002 required.' });

  const meterList = meters.split(',').map(m => m.trim());
  const indices   = meterList.map(m => {
    const idx = d.meters.indexOf(m);
    if (idx === -1) throw Object.assign(new Error(`Meter "${m}" not found.`), { status: 404 });
    return idx;
  });

  // Build per-meter daily map first
  const meterSeries = {};
  for (const [i, mi] of indices.entries()) {
    const id = meterList[i];
    meterSeries[id] = [];

    if (resolution === 'daily') {
      for (const dayKey of d.sortedDayKeys) {
        const sumArr = d.meterDailySum.get(dayKey);
        const cntArr = d.meterDailyCnt.get(dayKey);
        const cnt    = cntArr[mi];
        meterSeries[id].push({
          date   : dayKey,
          avgLoad: cnt > 0 ? +(sumArr[mi] / cnt).toFixed(4) : 0,
        });
      }
    } else {
      const monthMap = new Map();
      for (const dayKey of d.sortedDayKeys) {
        const mk     = dayKey.slice(0, 7);
        if (!monthMap.has(mk)) monthMap.set(mk, { sum: 0, cnt: 0 });
        const e      = monthMap.get(mk);
        const sumArr = d.meterDailySum.get(dayKey);
        const cntArr = d.meterDailyCnt.get(dayKey);
        e.sum += sumArr[mi];
        e.cnt += cntArr[mi];
      }
      for (const [mk, { sum, cnt }] of [...monthMap.entries()].sort()) {
        meterSeries[id].push({ date: mk, avgLoad: cnt > 0 ? +(sum / cnt).toFixed(4) : 0 });
      }
    }
  }

  res.json({ resolution, meters: meterList, series: meterSeries });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/anomaly-score?meter=MT_001&topN=50
//   Returns a list of sampled timestamps ranked by z-score for a given meter.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/anomaly-score', (req, res) => {
  const d = requireData(res); if (!d) return;

  const { meter, topN = '50' } = req.query;
  if (!meter) return res.status(400).json({ error: '?meter= required.' });

  const mi = d.meters.indexOf(meter);
  if (mi === -1) return res.status(404).json({ error: `Meter "${meter}" not found.` });

  const stat = d.meterStats[mi];
  const rows = d.sampledTimestamps.map((dt, si) => {
    const val    = d.sampledValues[si][mi];
    const zscore = stat.std > 0 ? (val - stat.mean) / stat.std : 0;
    return { datetime: dt, value: +val.toFixed(4), zscore: +zscore.toFixed(3) };
  });

  rows.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));
  const n = Math.min(parseInt(topN) || 50, 500);

  res.json({ meter, meterStat: stat, topAnomalies: rows.slice(0, n) });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/charts  — list available pre-generated PNG charts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/charts', (req, res) => {
  const charts = [
    { name: 'audit_distributions',  filename: 'section1_audit_distributions.png',  title: 'Data Audit – Value Distributions' },
    { name: 'daily_load_curve',     filename: 'section3_daily_load_curve.png',      title: 'Daily Load Curve (24-hour profile)' },
    { name: 'monthly_boxplots',     filename: 'section3_monthly_boxplots.png',      title: 'Monthly Load Distribution (Boxplots)' },
    { name: 'weekly_heatmap',       filename: 'section3_weekly_heatmap.png',        title: 'Weekly Usage Heatmap (DoW × Hour)' },
    { name: 'distribution_fits',    filename: 'section4_distribution_fits.png',     title: 'Statistical Distribution Fits' },
  ].map(c => ({ ...c, url: `/charts/${c.filename}` }));

  res.json({ count: charts.length, charts });
});

module.exports = router;
