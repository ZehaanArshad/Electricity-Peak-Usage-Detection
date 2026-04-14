import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <a href="/" className="sidebar-logo">
        <div className="logo-icon">⚡</div>
        <div className="logo-text">
          Peak<span>Det</span><br />
          Energy AI
        </div>
      </a>

      <div className="sidebar-section-title">Dashboard</div>
      
      <NavLink to="/overview" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">📊</span> Overview
      </NavLink>
      <NavLink to="/meters" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🔌</span> Meters
      </NavLink>
      <NavLink to="/peaks" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🚨</span> Peak Events
      </NavLink>
      
      <div className="sidebar-section-title">Exports</div>
      <NavLink to="/charts" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🖼️</span> Legacy Charts
      </NavLink>

      <div className="sidebar-footer">
        132k rows • 15m intervals<br />
        Built with Vite + React + Recharts
      </div>
    </aside>
  )
}
