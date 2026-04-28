require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadData, getData } = require('./dataLoader');

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ───────────────────────────────────────────────────────────────────────
const rawOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = rawOrigins
  ? rawOrigins.split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:4173'];

const corsOrigin = allowedOrigins.includes('*') ? '*' : allowedOrigins;

app.use(cors({
  origin: corsOrigin,
  methods: ['GET'],
  credentials: false
}));

app.use(express.json());

// Serve static charts from the root 'outputs' folder
app.use('/charts', express.static(path.join(__dirname, '../outputs')));

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const d = getData();
  
  if (d.error) {
    return res.status(500).json({ 
      status: 'error', 
      message: d.error,
      suggestion: 'Check CSV_URL and ALLOWED_ORIGINS environment variables.'
    });
  }

  if (!d.isLoaded) {
    return res.json({ status: 'loading' });
  }

  res.json({ 
    status: 'ok',
    numMeters: d.numMeters,
    totalRows: d.totalRows
  });
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api', require('./routes/api'));

// ── Root ───────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ 
    message: 'Electricity Peak Detection API is running!',
    endpoints: ['/api/health', '/api/summary', '/api/meters', '/charts']
  });
});

// ── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`🌍 CORS allowed origins: ${JSON.stringify(corsOrigin)}`);
  
  if (!process.env.CSV_URL) {
    console.warn('⚠️  WARNING: CSV_URL environment variable is not set.');
  }

  loadData()
    .then(() => console.log('✅ Data loaded! All endpoints are ready.'))
    .catch(err => {
      console.error('❌ Error loading data:', err.message);
    });
});