const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadData } = require('./dataLoader');

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
// Set ALLOWED_ORIGINS env var to a comma-separated list of allowed origins,
// or to '*' to allow all origins (useful for debugging).
const rawOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = rawOrigins
  ? rawOrigins.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:4173'];

const corsOrigin = allowedOrigins.includes('*')
  ? '*'                  // wildcard — allow everything
  : allowedOrigins;      // pass array — cors pkg handles matching natively

app.use(cors({
  origin: corsOrigin,
  methods: ['GET'],
  credentials: false
}));

app.use(express.json());

// Serve static chart images from the outputs folder
app.use('/charts', express.static(path.join(__dirname, '../outputs')));

// All API routes
app.use('/api', require('./routes/api'));

// Home / health check for Render's uptime monitor
app.get('/', (req, res) => {
  res.json({ message: 'Electricity Peak Detection API is running!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed origins: ${JSON.stringify(corsOrigin)}`);
  console.log('Loading CSV data...');

  loadData()
    .then(() => console.log('Data loaded! All endpoints are ready.'))
    .catch(err => console.log('Error loading data:', err.message));
});
