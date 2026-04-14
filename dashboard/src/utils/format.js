export const fmt = {
  number : (n, dec = 0) => n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec }),
  power  : (n) => {
    if (n == null) return '—'
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GWh`
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MWh`
    if (n >= 1e3) return `${(n / 1e3).toFixed(2)} kWh`
    return `${Number(n).toFixed(2)} Wh`
  },
  hour   : (h) => `${String(h).padStart(2, '0')}:00`,
  pct    : (n) => n == null ? '—' : `${Number(n).toFixed(1)}%`,
  fixed  : (n, d = 2) => n == null ? '—' : Number(n).toFixed(d),
}
