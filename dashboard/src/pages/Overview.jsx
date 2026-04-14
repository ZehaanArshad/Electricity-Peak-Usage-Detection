import React from 'react'
import { useApi } from '../hooks/useApi'
import { fmt } from '../utils/format'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

export default function Overview() {
  const { data: summary, loading: l1 } = useApi('/api/summary')
  const { data: loadCurve, loading: l2 } = useApi('/api/daily-load-curve')
  const { data: heatmap, loading: l3 } = useApi('/api/heatmap')

  if (l1 || l2 || l3) return <div className="spinner-wrap"><div className="spinner" />Loading Overview...</div>

  // Prepare heatmap data
  const hours = Array.from({length: 24}, (_, i) => i)
  const maxHeat = Math.max(...(heatmap?.heatmap || []).flatMap(d => d.hours.map(h => h.avgLoad)))

  const ttFmt = (val, name) => [fmt.power(val), name]

  return (
    <div>
      <div className="page-header">
        <h1>Global Grid Overview</h1>
        <p>{fmt.number(summary?.totalRows)} readings across {summary?.numMeters} meters ({summary?.dateRange?.start.split(' ')[0]} to {summary?.dateRange?.end.split(' ')[0]})</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{background: 'rgba(0,200,255,.15)', color: 'var(--accent)'}}>⚡</div>
          <div>
            <div className="kpi-label">Total Load</div>
            <div className="kpi-value text-accent">{fmt.power(summary?.totalConsumption)}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{background: 'rgba(255,107,53,.15)', color: 'var(--orange)'}}>🔥</div>
          <div>
            <div className="kpi-label">Peak Demand Window</div>
            <div className="kpi-value text-orange">{fmt.hour(summary?.peakHour)} on {summary?.peakDay}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{background: 'rgba(176,106,255,.15)', color: 'var(--purple)'}}>🏢</div>
          <div>
            <div className="kpi-label">Top Consumer ({summary?.maxConsumer?.id})</div>
            <div className="kpi-value">{fmt.power(summary?.maxConsumer?.total)}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{background: 'rgba(0,229,160,.15)', color: 'var(--green)'}}>avg</div>
          <div>
            <div className="kpi-label">Avg Load per Meter</div>
            <div className="kpi-value">{fmt.power(summary?.avgConsumptionPerMeter)}</div>
          </div>
        </div>
      </div>

      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-title">Average Daily Load Curve</div>
          <div className="card-sub">24-hour composite profile across all meters</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={loadCurve?.profile} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tickFormatter={fmt.hour} minTickGap={20} />
                <YAxis tickFormatter={(v) => (v/1000).toFixed(0)+'k'} width={50} />
                <Tooltip formatter={ttFmt} labelFormatter={fmt.hour} contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border2)' }} />
                <Area type="monotone" dataKey="totalAvg" name="Avg Load" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorLoad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Weekly Demand Heatmap</div>
          <div className="card-sub">Day-of-week vs. Hour-of-day intensity</div>
          <div className="heatmap-grid" style={{ marginTop: '30px' }}>
            <div />
            {hours.map(h => <div key={`h${h}`} className="heatmap-hour-label">{h}</div>)}
            
            {heatmap?.heatmap.map(day => (
              <React.Fragment key={day.day}>
                <div className="heatmap-label">{day.day}</div>
                {day.hours.map(h => {
                  const intensity = Math.max(0.1, h.avgLoad / maxHeat)
                  return (
                    <div 
                      key={`${day.day}-${h.hour}`} 
                      className="heatmap-cell"
                      style={{ background: `rgba(0, 200, 255, ${intensity})` }}
                      title={`${day.day} ${fmt.hour(h.hour)}: ${fmt.power(h.avgLoad)}`}
                    />
                  )
                })}
              </React.Fragment>
            ))}
          </div>
          <div className="heatmap-legend">
            <span>Low</span>
            <div className="legend-bar"></div>
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  )
}
