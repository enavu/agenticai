'use client'

import { useEffect, useState } from 'react'
import { api, TravelData, TravelWatch, TravelPrice } from '@/lib/api'
import { Plane, Ticket, TrendingDown, ExternalLink, RefreshCw, PlusCircle, Check, X } from 'lucide-react'

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function computeAnalytics(history: TravelPrice[]) {
  if (history.length === 0) return null

  // Group by date (YYYY-MM-DD), take min price per day to avoid multi-option inflation
  const byDate: Record<string, number> = {}
  for (const p of history) {
    const d = new Date(p.checked_at).toISOString().slice(0, 10)
    if (byDate[d] === undefined || p.price < byDate[d]) byDate[d] = p.price
  }

  const entries = Object.entries(byDate).map(([d, price]) => ({
    price,
    dow: new Date(d).getDay(),
  }))

  // Average by day of week
  const dowSums: number[] = Array(7).fill(0)
  const dowCounts: number[] = Array(7).fill(0)
  for (const e of entries) {
    dowSums[e.dow] += e.price
    dowCounts[e.dow]++
  }
  const dowAvg: (number | null)[] = dowSums.map((s, i) => dowCounts[i] > 0 ? s / dowCounts[i] : null)

  const allPrices = entries.map(e => e.price)
  const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length
  const min = Math.min(...allPrices)
  const max = Math.max(...allPrices)

  // Best / worst day (only days with data)
  let bestDow = -1, worstDow = -1
  let bestAvg = Infinity, worstAvg = -Infinity
  for (let i = 0; i < 7; i++) {
    const v = dowAvg[i]
    if (v === null) continue
    if (v < bestAvg) { bestAvg = v; bestDow = i }
    if (v > worstAvg) { worstAvg = v; worstDow = i }
  }

  // Trend: compare first half vs second half of data
  const sorted = [...entries].sort((a, b) => 0) // already desc from API
  const half = Math.floor(sorted.length / 2)
  const recentAvg = sorted.slice(0, half).reduce((s, e) => s + e.price, 0) / (half || 1)
  const olderAvg = sorted.slice(half).reduce((s, e) => s + e.price, 0) / (sorted.length - half || 1)
  const trend: 'up' | 'down' | 'flat' = recentAvg > olderAvg * 1.03 ? 'up' : recentAvg < olderAvg * 0.97 ? 'down' : 'flat'

  return { avg, min, max, dowAvg, bestDow, worstDow, bestAvg, worstAvg, trend, days: entries.length }
}

const WATCH_META: Record<string, { icon: React.ReactNode; color: string; barColor: string; link: string; linkLabel: string }> = {
  'watch-den-cdg-sep26': {
    icon: <Plane size={18} className="text-blue-400" />,
    color: 'text-blue-400', barColor: 'bg-blue-500',
    link: 'https://www.google.com/travel/flights?q=nonstop+flights+from+denver+to+paris+september+2026',
    linkLabel: 'Google Flights',
  },
  'watch-celine-paris-sep26': {
    icon: <Ticket size={18} className="text-violet-400" />,
    color: 'text-violet-400', barColor: 'bg-violet-500',
    link: 'https://www.stubhub.com/celine-dion-tickets/performer/7790',
    linkLabel: 'StubHub',
  },
  'watch-den-bwi-aug26': {
    icon: <Plane size={18} className="text-emerald-400" />,
    color: 'text-emerald-400', barColor: 'bg-emerald-500',
    link: 'https://www.google.com/travel/flights?q=nonstop+flights+from+denver+to+baltimore+august+8+2026',
    linkLabel: 'Google Flights',
  },
  'watch-den-las-nov26': {
    icon: <Plane size={18} className="text-amber-400" />,
    color: 'text-amber-400', barColor: 'bg-amber-500',
    link: 'https://www.google.com/travel/flights?q=nonstop+flights+from+denver+to+las+vegas+november+13+2026',
    linkLabel: 'Google Flights',
  },
  'watch-lisa-vegas-nov26': {
    icon: <Ticket size={18} className="text-pink-400" />,
    color: 'text-pink-400', barColor: 'bg-pink-500',
    link: 'https://www.stubhub.com/lisa-blackpink-tickets/performer/150420309',
    linkLabel: 'StubHub',
  },
}

function WatchCard({ watch, onPriceLogged }: { watch: TravelWatch; onPriceLogged: () => void }) {
  const [logging, setLogging] = useState(false)
  const [form, setForm] = useState({ price: '', stops: 'nonstop', notes: '' })
  const [saving, setSaving] = useState(false)

  const meta = WATCH_META[watch.id] ?? {
    icon: <Ticket size={18} className="text-neutral-400" />,
    color: 'text-neutral-400', barColor: 'bg-neutral-500',
    link: '#', linkLabel: 'Search',
  }

  const analytics = computeAnalytics(watch.history ?? [])
  const latest = watch.latest_prices ?? []

  async function submitPrice(e: React.FormEvent) {
    e.preventDefault()
    if (!form.price) return
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/travel/${watch.id}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          price: parseFloat(form.price),
          stops: form.stops || undefined,
          notes: form.notes || undefined,
        }),
      })
      if (res.ok) {
        setLogging(false)
        setForm({ price: '', stops: 'nonstop', notes: '' })
        onPriceLogged()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {meta.icon}
          <div>
            <h2 className="text-base font-semibold text-white">{watch.label}</h2>
            <p className="text-xs text-neutral-500 mt-0.5 capitalize">{watch.type} · nonstop</p>
          </div>
        </div>
        <a href={meta.link} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors">
          {meta.linkLabel} <ExternalLink size={12} />
        </a>
      </div>

      {/* Current options */}
      {latest.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Today's nonstop options</p>
          {latest.map((p, i) => (
            <div key={p.id ?? i} className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2">
              <span className={`text-lg font-bold ${meta.color}`}>{fmtPrice(p.price)}</span>
              {typeof p.details?.notes === 'string' && p.details.notes && (
                <span className="text-xs text-neutral-500">{p.details.notes}</span>
              )}
            </div>
          ))}
        </div>
      ) : watch.latest_price != null ? (
        <div className="flex items-end gap-2">
          <span className={`text-4xl font-bold ${meta.color}`}>{fmtPrice(watch.latest_price)}</span>
          <span className="text-sm text-neutral-500 mb-1">current best</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-neutral-500">
          <TrendingDown size={16} />
          <span className="text-sm">No price data yet — run a check or log manually</span>
        </div>
      )}

      {/* Analytics */}
      {analytics && analytics.days >= 3 && (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-neutral-800/40 rounded-lg py-2">
              <p className="text-xs text-neutral-500">Avg</p>
              <p className={`text-sm font-semibold ${meta.color}`}>{fmtPrice(analytics.avg)}</p>
            </div>
            <div className="bg-neutral-800/40 rounded-lg py-2">
              <p className="text-xs text-neutral-500">Low</p>
              <p className="text-sm font-semibold text-emerald-400">{fmtPrice(analytics.min)}</p>
            </div>
            <div className="bg-neutral-800/40 rounded-lg py-2">
              <p className="text-xs text-neutral-500">High</p>
              <p className="text-sm font-semibold text-rose-400">{fmtPrice(analytics.max)}</p>
            </div>
          </div>

          {/* Day-of-week bars */}
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Avg by day of week</p>
            <div className="flex items-end gap-1 h-16">
              {analytics.dowAvg.map((avg, i) => {
                if (avg === null) return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-neutral-800/30 rounded-sm" style={{ height: '4px' }} />
                    <span className="text-[10px] text-neutral-700">{DAYS[i]}</span>
                  </div>
                )
                const pct = analytics.max > analytics.min
                  ? ((avg - analytics.min) / (analytics.max - analytics.min)) * 70 + 10
                  : 40
                const isBest = i === analytics.bestDow
                const isWorst = i === analytics.worstDow
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <span className="text-[9px] text-neutral-500">{fmtPrice(avg)}</span>
                    <div
                      className={`w-full rounded-t-sm ${isBest ? 'bg-emerald-500' : isWorst ? 'bg-rose-500' : meta.barColor} opacity-80`}
                      style={{ height: `${pct}%` }}
                    />
                    <span className={`text-[10px] font-medium ${isBest ? 'text-emerald-400' : isWorst ? 'text-rose-400' : 'text-neutral-500'}`}>
                      {DAYS[i]}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] mt-1">
              {analytics.bestDow >= 0 && (
                <span className="text-emerald-400">✓ Best: {DAYS[analytics.bestDow]} ({fmtPrice(analytics.bestAvg)} avg)</span>
              )}
              {analytics.worstDow >= 0 && analytics.worstDow !== analytics.bestDow && (
                <span className="text-rose-400">↑ Priciest: {DAYS[analytics.worstDow]}</span>
              )}
            </div>
          </div>

          {/* Trend */}
          <p className="text-xs text-neutral-500">
            {analytics.trend === 'down' && <span className="text-emerald-400">↓ Prices trending down</span>}
            {analytics.trend === 'up' && <span className="text-rose-400">↑ Prices trending up</span>}
            {analytics.trend === 'flat' && <span className="text-neutral-400">→ Prices holding steady</span>}
            {' '}· {analytics.days} days of data
          </p>
        </div>
      )}

      {analytics && analytics.days < 3 && (
        <p className="text-xs text-neutral-600">Pattern analysis available after a few more days of data ({analytics.days} day{analytics.days !== 1 ? 's' : ''} so far)</p>
      )}

      {/* Manual log */}
      {logging ? (
        <form onSubmit={submitPrice} className="flex items-center gap-2">
          <input type="number" min="1" step="1" placeholder="Price $" value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-24 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            autoFocus required />
          <select value={form.stops} onChange={e => setForm(f => ({ ...f, stops: e.target.value }))}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none">
            <option value="nonstop">Nonstop</option>
            <option value="1 stop">1 stop</option>
          </select>
          <input type="text" placeholder="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none" />
          <button type="submit" disabled={saving} className="text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
          <button type="button" onClick={() => setLogging(false)} className="text-neutral-600 hover:text-neutral-400"><X size={14} /></button>
        </form>
      ) : (
        <button onClick={() => setLogging(true)}
          className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-300 transition-colors">
          <PlusCircle size={12} /> Log a price manually
        </button>
      )}
    </div>
  )
}

export default function TravelPage() {
  const [data, setData] = useState<TravelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  function load() {
    setLoading(true)
    api.travel.get()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }

  async function runCheck() {
    setChecking(true)
    try {
      await fetch('/api/v1/travel/check', { method: 'POST', credentials: 'include' })
      load()
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="flex items-center justify-center py-24 text-neutral-500 text-sm">Loading…</div>

  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Travel</h1>
      <p className="text-sm text-red-400">{error}</p>
    </div>
  )

  const watches = data?.watches ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Travel</h1>
          <p className="mt-1 text-sm text-neutral-400">Nonstop only · updated daily at 9am</p>
        </div>
        <button onClick={runCheck} disabled={checking}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Checking…' : 'Run Check'}
        </button>
      </div>

      {watches.length === 0 ? (
        <p className="text-sm text-neutral-500">No watches configured.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {watches.map((w) => <WatchCard key={w.id} watch={w} onPriceLogged={load} />)}
        </div>
      )}
    </div>
  )
}
