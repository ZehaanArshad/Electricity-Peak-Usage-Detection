import { useApi } from '../hooks/useApi'
import API_BASE from '../utils/apiBase'

export default function Charts() {
  const { data, loading } = useApi('/api/charts')

  if (loading) return <div className="spinner-wrap"><div className="spinner"/></div>

  return (
    <div>
      <div className="page-header">
        <h1>Pre-Generated Analysis Charts</h1>
        <p>Original static charts outputted by the data pipeline.</p>
      </div>

      <div className="grid-2">
        {data?.charts?.map(chart => (
          <div className="card" key={chart.filename} style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
              <div className="card-title" style={{ margin: 0 }}>{chart.title}</div>
            </div>
            <div style={{ background: '#fff', display: 'flex', justifyContent: 'center' }}>
              <img
                src={`${API_BASE}${chart.url}`}
                alt={chart.title}
                style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

