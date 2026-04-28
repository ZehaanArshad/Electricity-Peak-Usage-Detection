const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { parse } = require('csv-parse');

// ── Paths ──────────────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, '../data/cleaned');
const DATA_PATH = path.join(DATA_DIR, 'cleaned_data.csv');

// ── In-memory store ────────────────────────────────────────────────────────────
let store = {};
let isLoaded = false;

// ── CSV Download helper ────────────────────────────────────────────────────────
/**
 * Downloads a file from `url` to `destPath`.
 * - Follows up to 10 redirects
 * - Auto-converts any Google Drive share/view URL to the direct download endpoint
 * - Detects Google's virus-scan confirmation HTML page and bypasses it
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Convert any Google Drive URL variant to the direct usercontent endpoint
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
      if (redirectsLeft < 0) {
        return reject(new Error('Too many redirects while downloading CSV.'));
      }

      const proto = requestUrl.startsWith('https') ? https : http;

      proto.get(requestUrl, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, requestUrl).href;
          console.log(`Redirect ${MAX_REDIRECTS - redirectsLeft + 1}: ${next.slice(0, 80)}...`);
          return doRequest(next, redirectsLeft - 1);
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }

        const contentType = res.headers['content-type'] || '';

        // Google serves an HTML confirmation page for large files
        if (contentType.includes('text/html')) {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            // Try to extract file ID from the page and retry with confirm=t
            const idMatch = body.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
            const fileIdFromUrl = requestUrl.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
            const id = (idMatch || fileIdFromUrl)?.[1];
            if (id) {
              const retryUrl =
                `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
              console.log('Google confirmation page detected — retrying with confirm=t...');
              return doRequest(retryUrl, redirectsLeft - 1);
            }
            reject(new Error(
              'Received an HTML page instead of the CSV file. ' +
              'Ensure CSV_URL is a valid direct-download link.'
            ));
          });
          res.on('error', reject);
          return;
        }

        // Stream file to disk
        const total = parseInt(res.headers['content-length'], 10);
        let received = 0;
        const file = fs.createWriteStream(destPath);
        res.on('data', chunk => {
          received += chunk.length;
          if (total) {
            process.stdout.write(`\rDownloading CSV: ${((received / total) * 100).toFixed(1)}%   `);
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`\nDownload complete — ${(received / 1024).toFixed(0)} KB saved.`);
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
  if (isLoaded) return store;

  if (!fs.existsSync(DATA_PATH)) {
    const csvUrl = process.env.CSV_URL;
    if (!csvUrl) {
      throw new Error(
        'cleaned_data.csv not found locally and CSV_URL env var is not set. ' +
        'Set CSV_URL to the public direct-download link of the CSV file.'
      );
    }
    console.log(`CSV not found at ${DATA_PATH}. Downloading from CSV_URL...`);
    await downloadFile(csvUrl, DATA_PATH);
  } else {
    console.log('CSV found locally — skipping download.');
  }

  // Validate the downloaded file is not HTML before parsing
  const firstBytes = Buffer.alloc(20);
  const fd = fs.openSync(DATA_PATH, 'r');
  fs.readSync(fd, firstBytes, 0, 20, 0);
  fs.closeSync(fd);
  if (firstBytes.toString().trimStart().startsWith('<')) {
    fs.unlinkSync(DATA_PATH); // delete the bad HTML file
    throw new Error(
      'Downloaded file is an HTML page, not a CSV. ' +
      'The CSV_URL is not a valid direct-download link. ' +
      'Use: https://drive.usercontent.google.com/download?id=FILE_ID&export=download&confirm=t'
    );
  }

  return parseCSV();
}

// ── CSV Parsing ────────────────────────────────────────────────────────────────
function parseCSV() {
  return new Promise((resolve, reject) => {
    let headers = null;
    let rows = [];

    const parser = fs.createReadStream(DATA_PATH)
      .pipe(parse({ delimiter: ',', skip_empty_lines: true }));

    parser.on('data', (row) => {
      if (headers === null) {
        headers = row.slice(1); // meter IDs like MT_001, MT_002...
        return;
      }

      const dt = new Date(row[0].replace(' ', 'T'));
      if (isNaN(dt.getTime())) return;

      const values = [];
      for (let i = 1; i < row.length; i++) {
        values.push(parseFloat(row[i]) || 0);
      }

      rows.push({ dt, dtStr: row[0], values });
    });

    parser.on('end', () => {
      console.log(`Read ${rows.length} rows, ${headers.length} meters`);

      store.meters = headers;
      store.numMeters = headers.length;
      store.totalRows = rows.length;
      store.dateRange = {
        start: rows[0].dtStr,
        end: rows[rows.length - 1].dtStr
      };

      // Stats per meter
      store.meterStats = headers.map((id, i) => {
        let sum = 0, sumSq = 0, max = -Infinity, min = Infinity, count = 0;
        for (const row of rows) {
          const val = row.values[i];
          sum += val; sumSq += val * val;
          if (val > max) max = val;
          if (val < min) min = val;
          count++;
        }
        const mean = sum / count;
        const std = Math.sqrt(Math.max(0, (sumSq / count) - (mean * mean)));
        return {
          id,
          mean: +mean.toFixed(4),
          std: +std.toFixed(4),
          max: +max.toFixed(4),
          min: +min.toFixed(4),
          total: +sum.toFixed(2),
          count
        };
      });

      // 24-hour average load profile
      const hourlySum = Array(24).fill(0);
      const hourlyCnt = Array(24).fill(0);
      for (const row of rows) {
        const hour = row.dt.getHours();
        const total = row.values.reduce((a, b) => a + b, 0);
        hourlySum[hour] += total;
        hourlyCnt[hour]++;
      }
      store.hourlyProfile = hourlySum.map((sum, hour) => ({
        hour,
        totalAvg: +(sum / (hourlyCnt[hour] || 1)).toFixed(4),
        count: hourlyCnt[hour]
      }));

      // Monthly average
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthlySum = Array(12).fill(0);
      const monthlyCnt = Array(12).fill(0);
      for (const row of rows) {
        const month = row.dt.getMonth();
        const total = row.values.reduce((a, b) => a + b, 0);
        monthlySum[month] += total;
        monthlyCnt[month]++;
      }
      store.monthlyProfile = monthlySum.map((sum, month) => ({
        month,
        name: monthNames[month],
        totalAvg: +(sum / (monthlyCnt[month] || 1)).toFixed(4),
        count: monthlyCnt[month]
      }));

      // Day-of-week × Hour heatmap
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const dowHourSum = Array.from({ length: 7 }, () => Array(24).fill(0));
      const dowHourCnt = Array.from({ length: 7 }, () => Array(24).fill(0));
      for (const row of rows) {
        const dow = row.dt.getDay();
        const hour = row.dt.getHours();
        const total = row.values.reduce((a, b) => a + b, 0);
        dowHourSum[dow][hour] += total;
        dowHourCnt[dow][hour]++;
      }
      store.dowHourHeatmap = dayNames.map((day, d) => ({
        day,
        hours: Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          avgLoad: dowHourCnt[d][h] > 0 ? +(dowHourSum[d][h] / dowHourCnt[d][h]).toFixed(4) : 0,
          count: dowHourCnt[d][h]
        }))
      }));

      // Total load time series (sampled every 26 rows)
      store.totalLoadSeries = rows
        .filter((_, i) => i % 26 === 0)
        .map(row => ({
          dt: row.dtStr,
          v: +row.values.reduce((a, b) => a + b, 0).toFixed(4)
        }));

      // Sampled rows for peak detection
      store.sampledRows = rows.filter((_, i) => i % 26 === 0);

      // Daily totals per meter
      const dailyMap = {};
      for (const row of rows) {
        const dayKey = row.dt.toISOString().slice(0, 10);
        if (!dailyMap[dayKey]) {
          dailyMap[dayKey] = { sum: Array(headers.length).fill(0), cnt: Array(headers.length).fill(0) };
        }
        for (let i = 0; i < row.values.length; i++) {
          dailyMap[dayKey].sum[i] += row.values[i];
          dailyMap[dayKey].cnt[i]++;
        }
      }
      store.dailyMap = dailyMap;
      store.sortedDayKeys = Object.keys(dailyMap).sort();

      isLoaded = true;
      resolve(store);
    });

    parser.on('error', reject);
  });
}


module.exports = {
  loadData,
  getData: () => store,
  get isLoaded() { return isLoaded }   
}
