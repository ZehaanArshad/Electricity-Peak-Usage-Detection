import { useTheme } from '../context/ThemeContext'
import { useLocation } from 'react-router-dom'

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const loc = useLocation()
  
  const pageTitle = {
    '/overview': 'Executive Overview',
    '/meters': 'Meter Analysis',
    '/peaks': 'Peak Detection & Anomalies',
    '/charts': 'Pre-Generated Charts'
  }[loc.pathname] || 'Dashboard'

  return (
    <nav className="navbar">
      <div className="navbar-title">{pageTitle}</div>
      <div className="navbar-right">
        <div className="badge">LIVE DATA</div>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  )
}
