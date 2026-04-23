const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

const DATA_PATH = path.join(__dirname, '../data/cleaned/cleaned_data.csv');

// This object stores all the data after loading
let store = {};
let isLoaded = false;

async function loadData() {
  if (isLoaded) return store;

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

      // Calculate stats for each meter
      store.meterStats = headers.map((id, i) => {
        let sum = 0, sumSq = 0, max = -Infinity, min = Infinity, count = 0;

        for (const row of rows) {
          const val = row.values[i];
          sum += val;
          sumSq += val * val;
          if (val > max) max = val;
          if (val < min) min = val;
          count++;
        }

        const mean = sum / count;
        const variance = (sumSq / count) - (mean * mean);
        const std = Math.sqrt(Math.max(0, variance));

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

      // Sampled rows for peak detection (every 26th row)
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

    parser.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  loadData,
  getData: () => store
};
