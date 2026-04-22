import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useState } from 'react'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSidebarToggle = () => setSidebarOpen((open) => !open)
  const handleSidebarClose = () => setSidebarOpen(false)

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />
      <main className={`main-content${sidebarOpen ? ' sidebar-open' : ''}`} onClick={sidebarOpen ? handleSidebarClose : undefined}>
        <Navbar onSidebarToggle={handleSidebarToggle} />
        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
