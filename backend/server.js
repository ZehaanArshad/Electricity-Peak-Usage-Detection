const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadData } = require('./dataLoader');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Serve chart images from the outputs folder
app.use('/charts', express.static(path.join(__dirname, '../outputs')));

// All API routes
app.use('/api', require('./routes/api'));

// Home route
app.get('/', (req, res) => {
  res.json({ message: 'Electricity Peak Detection API is running!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Loading CSV data...');

  loadData()
    .then(() => console.log('Data loaded! All endpoints are ready.'))
    .catch(err => console.log('Error loading data:', err.message));
});
