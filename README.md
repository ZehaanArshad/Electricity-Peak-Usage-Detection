# ⚡ Electricity Peak Usage Detection

## Overview
The project addresses grid instability resulting from variable electricity demand. Using 15-minute grain data from the UCI Machine Learning Repository, we engineer a threshold system to isolate true peaks from sensor errors. This analysis, visualized through an interactive dashboard, empowers utility teams to optimize planning, cut costs, and implement effective demand-response strategies.

## 📊 Dataset Information
- **Source:** UCI Electricity Load Diagrams (2011–2014)
- **Clients:** 370 industrial/commercial clients (`MT_001` – `MT_370`)
- **Frequency:** 15-minute intervals
- **Unit:** kWh

## 🛠 Tech Stack
- **Data Analysis & Processing:** Python, Jupyter Notebook
- **Backend API:** Node.js, Express, `csv-parse`
- **Frontend Dashboard:** React.js, Vite, Recharts, React Router DOM

## 📐 Architecture & Design

### Consumer Flow Diagram
![Consumer Flow Diagram](Consumer%20Flow%20Diagram.jpg)

### High-Level Design (HLD)
![High-Level Design](High-Level%20Design%20(HLD).jpg)

### Low-Level Design (LLD)
![Low-Level Design](Low-Level%20Design%20(LLD).jpg)

## 🚀 Getting Started

To run this project locally, follow these steps:

### 1. Backend Setup
The backend serves as a REST API for the dashboard, providing the processed electricity usage data.
```bash
cd backend
npm install
npm run dev
```
The backend server will typically start on `http://localhost:5000` (or as configured in your `.env` file).

### 2. Frontend Dashboard Setup
The frontend is an interactive React application built with Vite.
```bash
cd dashboard
npm install
npm run dev
```
Open the provided local URL (e.g., `http://localhost:5173`) in your browser to view the dashboard.

### 3. Data Analysis Notebook
You can explore the data cleaning, exploratory data analysis, and peak detection logic in the Jupyter Notebook:
- `electricity_peak_detection.ipynb`
