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
    // Backend is still parsing the CSV — poll every 3s until ready
    setTimeout(() => window.location.reload(), 3000)
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <h2>📂 Loading Large Dataset</h2>
        <p>Processing 132k rows across 370 meters...</p>
        <p style={{ marginTop: '10px', fontSize: '13px', opacity: 0.6 }}>
          Checking again in 3 seconds...
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
