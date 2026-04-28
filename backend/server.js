const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadData } = require('./dataLoader');

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow any origin in development; restrict to your Vercel URL in production.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. Render health checks, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
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
  console.log('Loading CSV data...');

  loadData()
    .then(() => console.log('Data loaded! All endpoints are ready.'))
    .catch(err => console.log('Error loading data:', err.message));
});

  loadData()
    .then(() => console.log('Data loaded! All endpoints are ready.'))
    .catch(err => console.log('Error loading data:', err.message));
});
