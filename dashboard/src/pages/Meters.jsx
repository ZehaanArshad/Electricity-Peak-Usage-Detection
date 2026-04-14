import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { fmt } from '../utils/format'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function Meters() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('total')
  const [selectedMeter, setSelectedMeter] = useState('MT_362') // Default to top consumer

  const { data, loading } = useApi(`/api/meter-stats?limit=370&sort=${sort}&search=${search}`)
  const { data: tsData, loading: tsLoading } = useApi(`/api/meter-timeseries?meter=${selectedMeter}&resolution=monthly`, [selectedMeter])
  const { data: distData } = useApi(`/api/distribution?meter=${selectedMeter}`, [selectedMeter])

  return (
    <div>
      <div className="page-header">
        <h1>Meter Analysis</h1>
        <p>Detailed view of 370 smart meters and their historical consumption.</p>
      </div>

      <div className="grid-2">
        {/* LEFT COL: Meter List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
          <div className="control-row">
            <div className="field">
              <label>Search Meter</label>
              <input type="text" placeholder="e.g. MT_005" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="field">
              <label>Sort By</label>
              <select value={sort} onChange={e => setSort(e.target.value)}>
                <option value="total">Total Consumption ↓</option>
                <option value="max">Max Peak ↓</option>
                <option value="std">Volatility (Std Dev) ↓</option>
                <option value="id">Meter ID ↑</option>
              </select>
            </div>
            <div style={{marginLeft: 'auto', fontSize: '12px', color: 'var(--text2)'}}>
              {data?.stats?.length || 0} meters found
            </div>
          </div>

          <div className="table-wrap" style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)' }}>
            {loading ? (
              <div className="empty-msg">Loading meters...</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Meter ID</th>
                    <th className="text-right">Total Load</th>
                    <th className="text-right">Max Peak</th>
                    <th className="text-right">Volatility (σ)</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.stats.map(m => (
                    <tr 
                      key={m.id} 
                      onClick={() => setSelectedMeter(m.id)}
                      style={{ 
                        cursor: 'pointer', 
                        background: selectedMeter === m.id ? 'var(--bg3)' : '',
                        borderLeft: selectedMeter === m.id ? '3px solid var(--accent)' : '3px solid transparent'
                      }}
                    >
                      <td className="mono fw-700">{m.id}</td>
                      <td className="text-right">{fmt.power(m.total)}</td>
                      <td className="text-right">{fmt.power(m.max)}</td>
                      <td className="text-right text-muted">{fmt.fixed(m.std)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT COL: Meter Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          <div className="card">
            <div className="card-title">Monthly Trend: {selectedMeter}</div>
            <div className="card-sub">{tsLoading ? 'Loading...' : 'Monthly average load over 4 years'}</div>
            <div style={{ width: '100%', height: 220 }}>
              {!tsLoading && tsData?.series && (
                <ResponsiveContainer>
                  <LineChart data={tsData.series} margin={{top:5, right:5, left:0, bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={d => d.slice(2)} minTickGap={30} />
                    <YAxis width={50} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
                    <RTooltip 
                      formatter={(v) => [fmt.power(v), 'Avg Load']}
                      contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border2)' }} 
                    />
                    <Line type="monotone" dataKey="avgLoad" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Load Distribution: {selectedMeter}</div>
            <div className="card-sub">Histogram of load values (Bin size ~{fmt.fixed(distData?.bins?.[0]?.binEnd - distData?.bins?.[0]?.binStart)})</div>
            <div style={{ width: '100%', height: 220 }}>
              {distData?.bins && (
                <ResponsiveContainer>
                  <BarChart data={distData.bins} margin={{top:5, right:5, left:0, bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="binStart" tickFormatter={v => (v/1000).toFixed(0)+'k'} minTickGap={30} />
                    <YAxis width={40} />
                    <RTooltip 
                      formatter={v => [fmt.number(v), 'Count']}
                      labelFormatter={v => `Load: ${fmt.fixed(v)}`}
                      contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border2)' }} 
                    />
                    <Bar dataKey="count" fill="var(--purple)" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            {distData?.stats && (
              <div style={{display: 'flex', gap: '20px', marginTop: '10px', fontSize: '11px', color: 'var(--text2)', justifyContent: 'center'}}>
                <span>P50: <strong>{fmt.fixed(distData.stats.p50)}</strong></span>
                <span>P90: <strong>{fmt.fixed(distData.stats.p90)}</strong></span>
                <span>P95: <strong className="text-orange">{fmt.fixed(distData.stats.p95)}</strong></span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
