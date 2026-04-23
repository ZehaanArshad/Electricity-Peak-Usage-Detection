const express = require('express');
const router = express.Router();
const { getData } = require('../dataLoader');

// Helper to check if data is loaded
function checkData(res) {
  const d = getData();
  if (!d.meters) {
    res.status(503).json({ error: 'Data is still loading. Please wait.' });
    return null;
  }
  return d;
}

// GET /api/health
router.get('/health', (req, res) => {
  const d = getData();
  res.json({
    status: d.meters ? 'ready' : 'loading',
    totalRows: d.totalRows || 0,
    numMeters: d.numMeters || 0,
    dateRange: d.dateRange || null
  });
});

// GET /api/summary
router.get('/summary', (req, res) => {
  const d = checkData(res);
  if (!d) return;

  const totalConsumption = d.meterStats.reduce((sum, m) => sum + m.total, 0);
  const avgPerMeter = totalConsumption / d.numMeters;

  const maxConsumer = d.meterStats.reduce((a, b) => a.total > b.total ? a : b);
  const minConsumer = d.meterStats.reduce((a, b) => a.total < b.total ? a : b);

  const peakHour = d.hourlyProfile.reduce((a, b) => a.totalAvg > b.totalAvg ? a : b);

  const peakDay = d.dowHourHeatmap.reduce((a, b) => {
    const sumA = a.hours.reduce((s, h) => s + h.avgLoad, 0);
    const sumB = b.hours.reduce((s, h) => s + h.avgLoad, 0);
    return sumA > sumB ? a : b;
  });

  res.json({
    totalRows: d.totalRows,
    numMeters: d.numMeters,
    dateRange: d.dateRange,
    totalConsumption: +totalConsumption.toFixed(2),
    avgConsumptionPerMeter: +avgPerMeter.toFixed(4),
    maxConsumer: { id: maxConsumer.id, total: maxConsumer.total },
    minConsumer: { id: minConsumer.id, total: minConsumer.total },
    peakHour: peakHour.hour,
    peakDay: peakDay.day
  });
});

// GET /api/meters
router.get('/meters', (req, res) => {
  const d = checkData(res);
  if (!d) return;
  res.json({ count: d.meters.length, meters: d.meters });
});

// GET /api/meter-stats?sort=total&order=desc&limit=20
router.get('/meter-stats', (req, res) => {
  const d = checkData(res);
  if (!d) return;

  const sort = req.query.sort || 'total';
  const order = req.query.order || 'desc';
  const limit = parseInt(req.query.limit) || 370;
  const search = req.query.search || '';

  let stats = [...d.meterStats];

  if (search) {
    stats = stats.filter(m => m.id.toLowerCase().includes(search.toLowerCase()));
  }

  stats.sort((a, b) => {
    if (sort === 'id') {
      return order === 'desc' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
    }
    return order === 'desc' ? b[sort] - a[sort] : a[sort] - b[sort];
  });

  res.json({ total: stats.length, stats: stats.slice(0, limit) });
});

// GET /api/daily-load-curve
router.get('/daily-load-curve', (req, res) => {
  const d = checkData(res);
  if (!d) return;
  res.json({ profile: d.hourlyProfile });
});

// GET /api/monthly-trends
router.get('/monthly-trends', (req, res) => {
  const d = checkData(res);
  if (!d) return;
  res.json({ trends: d.monthlyProfile });
});

// GET /api/heatmap
router.get('/heatmap', (req, res) => {
  const d = checkData(res);
  if (!d) return;
  res.json({ heatmap: d.dowHourHeatmap });
});

// GET /api/top-consumers?limit=10
router.get('/top-consumers', (req, res) => {
  const d = checkData(res);
  if (!d) return;
  const limit = parseInt(req.query.limit) || 10;
  const sorted = [...d.meterStats].sort((a, b) => b.total - a.total);
  res.json({ topConsumers: sorted.slice(0, limit) });
});

// GET /api/total-load-series?sample=1000
router.get('/total-load-series', (req, res) => {
  const d = checkData(res);
  if (!d) return;

  const series = d.totalLoadSeries.map(r => ({
    datetime: r.dt,
    totalLoad: r.v
  }));

  res.json({ total: series.length, series });
});

// GET /api/meter-timeseries?meter=MT_001&resolution=daily
router.get('/meter-timeseries', (req, res) => {
  const d = checkData(res);
  if (!d) return;

  const meter = req.query.meter;
  const resolution = req.query.resolution || 'daily';

  if (!meter) return res.status(400).json({ error: '?meter= is required' });

  const meterIdx = d.meters.indexOf(meter);
  if (meterIdx === -1) return res.status(404).json({ error: `Meter "${meter}" not found` });

  const result = [];

  if (resolution === 'daily') {
    for (const dayKey of d.sortedDayKeys) {
      const entry = d.dailyMap[dayKey];
      const cnt = entry.cnt[meterIdx];
      result.push({
        date: dayKey,
        avgLoad: cnt > 0 ? +(entry.sum[meterIdx] / cnt).toFixed(4) : 0,
        totalLoad: +entry.sum[meterIdx].toFixed(4)
      });
    }
  } else if (resolution === 'monthly') {
    const monthMap = {};
    for (const dayKey of d.sortedDayKeys) {
      const monthKey = dayKey.slice(0, 7);
      if (!monthMap[monthKey]) monthMap[monthKey] = { sum: 0, cnt: 0 };
      monthMap[monthKey].sum += d.dailyMap[dayKey].sum[meterIdx];
      monthMap[monthKey].cnt += d.dailyMap[dayKey].cnt[meterIdx];
    }
    for (const monthKey of Object.keys(monthMap).sort()) {
      const { sum, cnt } = monthMap[monthKey];
      result.push({
        date: monthKey,
        avgLoad: cnt > 0 ? +(sum / cnt).toFixed(4) : 0,
        totalLoad: +sum.toFixed(4)
      });
    }
  } else {
    return res.status(400).json({ error: 'resolution must be "daily" or "monthly"' });
  }

  res.json({ meter, resolution, count: result.length, series: result });
});

// GET /api/peak-detection?threshold=2.0&meter=ALL&limit=200
router.get('/peak-detection', (req, res) => {
  const d = checkData(res);
  if (!d) return;

  const threshold = parseFloat(req.query.threshold) || 2.0;
  const meterParam = (req.query.meter || 'ALL').toUpperCase();
  const limit = parseInt(req.query.limit) || 200;

  const peaks = [];

  const findPeaks = (meterIdx) => {
    const stat = d.meterStats[meterIdx];
    const cutoff = stat.mean + threshold * stat.std;

    for (const row of d.sampledRows) {
      const val = row.values[meterIdx];
      if (val > cutoff) {
        peaks.push({
          datetime: row.dtStr,
          meter: d.meters[meterIdx],
          value: +val.toFixed(4),
          zscore: stat.std > 0 ? +((val - stat.mean) / stat.std).toFixed(3) : 0,
          threshold: +cutoff.toFixed(4)
        });
      }
    }
  };

  if (meterParam === 'ALL') {
    for (let i = 0; i < d.numMeters; i++) findPeaks(i);
  } else {
    const mi = d.meters.indexOf(meterParam);
    if (mi === -1) return res.status(404).json({ error: `Meter "${meterParam}" not found` });
    findPeaks(mi);
  }

  peaks.sort((a, b) => b.zscore - a.zscore);

  res.json({
    meter: meterParam,
    threshold,
    totalPeaks: peaks.length,
    peaks: peaks.slice(0, limit)
  });
});

// GET /api/distribution?meter=MT_001&bins=30
router.get('/distribution', (req, res) => {
  const d = checkData(res);
  if (!d) return;

  const meter = req.query.meter;
  const binCount = parseInt(req.query.bins) || 30;

  let values;
  if (meter) {
    const mi = d.meters.indexOf(meter);
    if (mi === -1) return res.status(404).json({ error: `Meter "${meter}" not found` });
    values = d.sampledRows.map(row => row.values[mi]);
  } else {
    values = d.sampledRows.map(row => row.values.reduce((a, b) => a + b, 0));
  }

  const nonZero = values.filter(v => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return res.json({ bins: [], stats: {} });

  const minVal = nonZero[0];
  const maxVal = nonZero[nonZero.length - 1];
  const binWidth = (maxVal - minVal) / binCount || 1;

  const histogram = Array.from({ length: binCount }, (_, i) => ({
    binStart: +(minVal + i * binWidth).toFixed(4),
    binEnd: +(minVal + (i + 1) * binWidth).toFixed(4),
    count: 0
  }));

  for (const v of nonZero) {
    const idx = Math.min(binCount - 1, Math.floor((v - minVal) / binWidth));
    histogram[idx].count++;
  }

  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  const variance = nonZero.reduce((s, v) => s + (v - mean) ** 2, 0) / nonZero.length;
  const pct = (p) => nonZero[Math.floor(nonZero.length * p)];

  res.json({
    meter: meter || 'ALL',
    bins: histogram,
    stats: {
      mean: +mean.toFixed(4),
      std: +Math.sqrt(variance).toFixed(4),
      min: +minVal.toFixed(4),
      max: +maxVal.toFixed(4),
      count: nonZero.length,
      p25: +pct(0.25).toFixed(4),
      p50: +pct(0.50).toFixed(4),
      p75: +pct(0.75).toFixed(4),
      p95: +pct(0.95).toFixed(4)
    }
  });
});

// GET /api/anomaly-score?meter=MT_001&topN=50
router.get('/anomaly-score', (req, res) => {
  const d = checkData(res);
  if (!d) return;

  const meter = req.query.meter;
  const topN = parseInt(req.query.topN) || 50;

  if (!meter) return res.status(400).json({ error: '?meter= is required' });

  const mi = d.meters.indexOf(meter);
  if (mi === -1) return res.status(404).json({ error: `Meter "${meter}" not found` });

  const stat = d.meterStats[mi];

  const rows = d.sampledRows.map(row => {
    const val = row.values[mi];
    const zscore = stat.std > 0 ? (val - stat.mean) / stat.std : 0;
    return { datetime: row.dtStr, value: +val.toFixed(4), zscore: +zscore.toFixed(3) };
  });

  rows.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));

  res.json({ meter, meterStat: stat, topAnomalies: rows.slice(0, topN) });
});

// GET /api/charts
router.get('/charts', (req, res) => {
  const charts = [
    { name: 'audit_distributions', filename: 'section1_audit_distributions.png', title: 'Data Audit' },
    { name: 'daily_load_curve', filename: 'section3_daily_load_curve.png', title: 'Daily Load Curve' },
    { name: 'monthly_boxplots', filename: 'section3_monthly_boxplots.png', title: 'Monthly Boxplots' },
    { name: 'weekly_heatmap', filename: 'section3_weekly_heatmap.png', title: 'Weekly Heatmap' },
    { name: 'distribution_fits', filename: 'section4_distribution_fits.png', title: 'Distribution Fits' }
  ].map(c => ({ ...c, url: `/charts/${c.filename}` }));

  res.json({ count: charts.length, charts });
});

// GET /api/compare-meters?meters=MT_001,MT_002&resolution=monthly
router.get('/compare-meters', (req, res) => {
  const d = checkData(res);
  if (!d) return;

  const metersParam = req.query.meters;
  const resolution = req.query.resolution || 'monthly';

  if (!metersParam) return res.status(400).json({ error: '?meters=MT_001,MT_002 required' });

  const meterList = metersParam.split(',').map(m => m.trim());
  const indices = meterList.map(m => d.meters.indexOf(m));

  for (let i = 0; i < meterList.length; i++) {
    if (indices[i] === -1) return res.status(404).json({ error: `Meter "${meterList[i]}" not found` });
  }

  const series = {};

  for (let i = 0; i < meterList.length; i++) {
    const id = meterList[i];
    const mi = indices[i];
    series[id] = [];

    if (resolution === 'daily') {
      for (const dayKey of d.sortedDayKeys) {
        const entry = d.dailyMap[dayKey];
        const cnt = entry.cnt[mi];
        series[id].push({ date: dayKey, avgLoad: cnt > 0 ? +(entry.sum[mi] / cnt).toFixed(4) : 0 });
      }
    } else {
      const monthMap = {};
      for (const dayKey of d.sortedDayKeys) {
        const mk = dayKey.slice(0, 7);
        if (!monthMap[mk]) monthMap[mk] = { sum: 0, cnt: 0 };
        monthMap[mk].sum += d.dailyMap[dayKey].sum[mi];
        monthMap[mk].cnt += d.dailyMap[dayKey].cnt[mi];
      }
      for (const mk of Object.keys(monthMap).sort()) {
        const { sum, cnt } = monthMap[mk];
        series[id].push({ date: mk, avgLoad: cnt > 0 ? +(sum / cnt).toFixed(4) : 0 });
      }
    }
  }

  res.json({ resolution, meters: meterList, series });
});

module.exports = router;
