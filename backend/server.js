const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadData, getData, isLoaded } = require('./dataLoader'); // ← fixed, single import

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

app.use('/charts', express.static(path.join(__dirname, '../outputs')));

// ── Health check ───────────────────────────────────────────────────────────────
// ⚠️ MUST be before app.use('/api', ...) otherwise it gets intercepted
app.get('/api/health', (req, res) => {
  if (!isLoaded) {
    return res.json({ status: 'loading' })
  }
  res.json({ status: 'ok' })
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api', require('./routes/api'));

// ── Root ───────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'Electricity Peak Detection API is running!' });
});

// ── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed origins: ${JSON.stringify(corsOrigin)}`);
  console.log('Loading CSV data...');

  loadData()
    .then(() => console.log('Data loaded! All endpoints are ready.'))
    .catch(err => console.error('Error loading data:', err.message));
});