import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { fmt } from '../utils/format'

export default function Peaks() {
  const [threshold, setThreshold] = useState(2.5)
  const [meter, setMeter] = useState('ALL')
  
  const { data, loading } = useApi(`/api/peak-detection?threshold=${threshold}&meter=${meter}&limit=200`, [threshold, meter])
  const { data: meters } = useApi('/api/meters')

  return (
    <div>
      <div className="page-header">
        <h1>Peak Event Detection</h1>
        <p>Identify anomalous usage spikes based on Z-Score statistical thresholds.</p>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="control-row">
          <div className="field">
            <label>Z-Score Threshold: {threshold}σ</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="range" min="1" max="5" step="0.1" 
                value={threshold} 
                onChange={e => setThreshold(Number(e.target.value))} 
              />
              <span className="mono">{threshold.toFixed(1)}</span>
            </div>
          </div>
          <div className="field">
            <label>Filter by Meter</label>
            <select value={meter} onChange={e => setMeter(e.target.value)}>
              <option value="ALL">All Meters</option>
              {meters?.meters?.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{marginLeft: 'auto'}}>
            <div className="badge badge-red" style={{ fontSize: '13px', padding: '6px 14px'}}>
              {loading ? 'Scanning...' : `${fmt.number(data?.totalPeaks)} Peaks Found`}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : data?.peaks?.length === 0 ? (
            <div className="empty-msg">No peaks found above {threshold}σ threshold.<br/>Try lowering the threshold.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Meter</th>
                  <th className="text-right">Load Value</th>
                  <th className="text-right">Threshold Line ({threshold}σ)</th>
                  <th className="text-right">Severity (Z-Score)</th>
                </tr>
              </thead>
              <tbody>
                {data?.peaks.map((p, i) => (
                  <tr key={i}>
                    <td className="mono">{p.datetime}</td>
                    <td className="mono fw-700">{p.meter}</td>
                    <td className="text-right text-red fw-700">{fmt.power(p.value)}</td>
                    <td className="text-right text-muted">{fmt.power(p.threshold)}</td>
                    <td className="text-right">
                      <span className={`badge-pill ${p.zscore > 4 ? 'badge-red' : p.zscore > 3 ? 'badge-orange' : ''}`}>
                        {p.zscore.toFixed(2)}σ
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {data?.returned < data?.totalPeaks && (
        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--text3)' }}>
          Showing top {data.returned} most severe events out of {fmt.number(data.totalPeaks)}.
        </div>
      )}
    </div>
  )
}
