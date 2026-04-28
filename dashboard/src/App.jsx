import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useApi } from './hooks/useApi'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import Meters from './pages/Meters'
import Peaks from './pages/Peaks'
import Charts from './pages/Charts'

function App() {
  // Global health/loading check
  const { data: health, loading, error } = useApi('/api/health')

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <h2>Connecting to Backend...</h2>
    </div>
  )

  if (error) return (
    <div className="loading-screen">
      <h2>⚠️ Backend Error</h2>
      <p className="error-msg">{error}</p>
      <p>Is the server running on port 3001?</p>
    </div>
  )

  if (health?.status === 'loading') {
    return (
      <div className="loading-screen">
        <h2>📂 Loading Large Dataset</h2>
        <p>Processing 132k rows across 370 meters...</p>
        <div className="progress-bar-wrap mt-6">
          <div className="progress-bar-fill" style={{ width: `${health.loading.pct}%` }}></div>
        </div>
        <p style={{ marginTop: '10px', fontSize: '13px' }}>
          {health.loading.pct}% &mdash; ETA {Math.max(0, 15 - (health.loading.elapsedSec || 0)).toFixed(0)}s
        </p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="meters" element={<Meters />} />
          <Route path="peaks" element={<Peaks />} />
          <Route path="charts" element={<Charts />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
