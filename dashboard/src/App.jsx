import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useApi } from './hooks/useApi'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import Meters from './pages/Meters'
import Peaks from './pages/Peaks'
import Charts from './pages/Charts'

function App() {
  // Global health/loading check
  const { data: health, loading, error, refetch } = useApi('/api/health')

  // While backend is still processing the CSV, poll every 4 seconds
  useEffect(() => {
    if (health?.status !== 'loading') return
    const id = setInterval(refetch, 4000)
    return () => clearInterval(id)
  }, [health?.status, refetch])

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
      <p style={{ marginTop: '12px', fontSize: '13px', opacity: 0.7 }}>
        The backend may still be starting up on Render (free tier can take ~30s).
      </p>
      <button
        onClick={refetch}
        style={{
          marginTop: '16px', padding: '8px 20px', cursor: 'pointer',
          background: '#4f8ef7', color: '#fff', border: 'none',
          borderRadius: '6px', fontSize: '14px'
        }}
      >
        Retry
      </button>
    </div>
  )

  if (health?.status === 'loading') return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <h2>📂 Loading Large Dataset</h2>
      <p>Processing 132k rows across 370 meters...</p>
      <p style={{ marginTop: '10px', fontSize: '13px', opacity: 0.6 }}>
        Checking again every 4 seconds...
      </p>
    </div>
  )

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
