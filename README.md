# ⚡ Electricity Peak Usage Detection

[![Node.js](https://img.shields.io/badge/Backend-Node.js-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/Frontend-React-blue?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite-purple?style=flat-square&logo=vite)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

An end-to-end data engineering and visualization platform designed to identify, analyze, and visualize peak electricity demand across 370 industrial and commercial clients.

---

## 📖 Overview

Grid instability often results from unpredictable surges in electricity demand. This project addresses the challenge by processing high-frequency (15-minute grain) smart meter data from the **UCI Machine Learning Repository**. 

Using a custom-built statistical engine, we isolate true demand peaks from sensor noise using **Z-score anomaly detection**. The results are served through a high-performance Node.js API and visualized in an interactive React dashboard, empowering utility teams to optimize grid planning and implement effective demand-response strategies.

## ✨ Key Features

- **⚡ Real-time Peak Detection:** Automated Z-score based anomaly detection to isolate surges.
- **📊 Interactive Visualizations:** Dynamic time-series charts, heatmaps, and distribution plots using Recharts.
- **🚀 High-Performance Processing:** Stream-based CSV parsing for memory-efficient handling of millions of rows.
- **🔍 Granular Drill-down:** Analyze usage patterns for 370 individual meters or aggregate grid behavior.
- **📉 Data Auditing:** Built-in Python-based exploratory data analysis (EDA) and distribution fitting.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Analysis** | Python, Pandas, Matplotlib, Jupyter Notebook |
| **Backend** | Node.js, Express, `csv-parse` |
| **Frontend** | React (v19), Vite, Recharts, React Router DOM |
| **Deployment** | Render (Backend), Vercel/Netlify (Frontend) |

---

## 📐 Architecture & Design

The system follows a modern decoupled architecture:

### 1. Consumer Flow
Visualizes how raw electricity data flows from industrial meters through the processing pipeline into the final dashboard.
![Consumer Flow](Consumer%20Flow%20Diagram.jpg)

### 2. High-Level Design (HLD)
Shows the interaction between the data storage (CSV/Google Drive), the Node.js API server, and the React client.
![High-Level Design](High-Level%20Design%20(HLD).jpg)

### 3. Low-Level Design (LLD)
Details the internal logic of the `dataLoader`, including the streaming parser and statistical aggregation modules.
![Low-Level Design](Low-Level%20Design%20(LLD).jpg)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` folder based on `.env.example`:
```env
CSV_URL=your_direct_download_link_here
ALLOWED_ORIGINS=http://localhost:5173
PORT=3001
```
Run the development server:
```bash
npm run dev
```

### 2. Dashboard Setup
```bash
cd dashboard
npm install
npm run dev
```
The dashboard will be available at `http://localhost:5173`.

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/summary` | `GET` | Get aggregate statistics (total load, peak hours, etc.) |
| `/api/meters` | `GET` | List all 370 meter IDs |
| `/api/peak-detection` | `GET` | Find peaks based on `?threshold=` and `?meter=` |
| `/api/meter-stats` | `GET` | Get detailed stats (Mean, Std, Max) per meter |
| `/api/daily-load-curve` | `GET` | Get the aggregate hourly profile for the grid |
| `/api/charts` | `GET` | Retrieve metadata for static analysis charts |

---

## 📊 Data Analysis & Outputs
The analysis logic is contained in `electricity_peak_detection.ipynb`. Key visualizations generated during the research phase include:
- **Audit Distributions:** Validating data integrity across sensors.
- **Weekly Heatmaps:** Identifying cyclical patterns in commercial usage.
- **Distribution Fits:** Modeling the probability of extreme demand events.

Find these in the `outputs/` directory.

---

## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.
