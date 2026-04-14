/**
 * server.js  —  Electricity Peak Detection API
 * Starts Express immediately, loads CSV data in the background.
 * Endpoints return 503 until data is ready.
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { loadData, getLoadingStatus } = require('./dataLoader');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Serve pre-generated output charts ───────────────────────────────────────
app.use('/charts', express.static(
  path.join(__dirname, '../outputs'),
  { maxAge: '1h' }
));

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api', require('./routes/api'));

// ─── Root  —  API index ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name   : 'Electricity Peak Detection API',
    version: '1.0.0',
    status : getLoadingStatus().phase,
    endpoints: [
      { method: 'GET', path: '/api/loading-status',                  desc: 'Poll data-loading progress' },
      { method: 'GET', path: '/api/health',                          desc: 'Server + data health check' },
      { method: 'GET', path: '/api/summary',                         desc: 'High-level KPIs' },
      { method: 'GET', path: '/api/meters',                          desc: 'List all meter IDs' },
      { method: 'GET', path: '/api/meter-stats',                     desc: 'Per-meter statistics (sort/filter/limit)' },
      { method: 'GET', path: '/api/top-consumers?limit=10',          desc: 'Top N consuming meters' },
      { method: 'GET', path: '/api/daily-load-curve',                desc: '24-hour average load profile' },
      { method: 'GET', path: '/api/monthly-trends',                  desc: 'Monthly average consumption' },
      { method: 'GET', path: '/api/heatmap',                         desc: 'Day-of-week × Hour heatmap' },
      { method: 'GET', path: '/api/total-load-series?sample=1000',   desc: 'Total load over time (down-sampled)' },
      { method: 'GET', path: '/api/meter-timeseries?meter=MT_001&resolution=daily', desc: 'Per-meter daily/monthly time series' },
      { method: 'GET', path: '/api/peak-detection?threshold=2&meter=ALL&limit=200', desc: 'Peak event detection (z-score)' },
      { method: 'GET', path: '/api/distribution?meter=MT_001&bins=30', desc: 'Load value histogram' },
      { method: 'GET', path: '/api/compare-meters?meters=MT_001,MT_002', desc: 'Side-by-side meter comparison' },
      { method: 'GET', path: '/api/anomaly-score?meter=MT_001&topN=50',  desc: 'Top anomalous readings for a meter' },
      { method: 'GET', path: '/api/charts',                          desc: 'List pre-generated PNG chart files' },
      { method: 'GET', path: '/charts/<filename>',                   desc: 'Serve a chart PNG directly' },
    ],
  });
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(status).json({ error: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('⚡  Electricity Peak Detection API');
  console.log(`🚀  Server listening on http://localhost:${PORT}`);
  console.log(`📋  API index:          http://localhost:${PORT}/`);
  console.log(`💊  Health check:       http://localhost:${PORT}/api/health`);
  console.log(`📊  Loading status:     http://localhost:${PORT}/api/loading-status`);
  console.log('');
  console.log('📂  Loading CSV data … (large file — this may take a few minutes)');
  console.log('    Endpoints return HTTP 503 until loading completes.\n');

  loadData()
    .then(() => {
      console.log('\n✅  All data ready — all endpoints are now live.\n');
    })
    .catch(err => {
      console.error('\n❌  Fatal: failed to load data:', err.message);
    });
});
