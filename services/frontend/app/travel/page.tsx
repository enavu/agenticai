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

  const byDate: Record<string, number> = {}
  for (const p of history) {
    const d = new Date(p.checked_at).toISOString().slice(0, 10)
    if (byDate[d] === undefined || p.price < byDate[d]) byDate[d] = p.price
  }

  const entries = Object.entries(byDate).map(([d, price]) => ({ price, dow: new Date(d).getDay() }))
  const dowSums: number[] = Array(7).fill(0)
  const dowCounts: number[] = Array(7).fill(0)
  for (const e of entries) { dowSums[e.dow] += e.price; dowCounts[e.dow]++ }
  const dowAvg: (number | null)[] = dowSums.map((s, i) => dowCounts[i] > 0 ? s / dowCounts[i] : null)

  const allPrices = entries.map(e => e.price)
  const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length
  const min = Math.min(...allPrices)
  const max = Math.max(...allPrices)

  let bestDow = -1, worstDow = -1, bestAvg = Infinity, worstAvg = -Infinity
  for (let i = 0; i < 7; i++) {
    const v = dowAvg[i]
    if (v === null) continue
    if (v < bestAvg) { bestAvg = v; bestDow = i }
    if (v > worstAvg) { worstAvg = v; worstDow = i }
  }

  const half = Math.floor(entries.length / 2)
  const recentAvg = entries.slice(0, half).reduce((s, e) => s + e.price, 0) / (half || 1)
  const olderAvg = entries.slice(half).reduce((s, e) => s + e.price, 0) / (entries.length - half || 1)
  const trend: 'up' | 'down' | 'flat' = recentAvg > olderAvg * 1.03 ? 'up' : recentAvg < olderAvg * 0.97 ? 'down' : 'flat'

  return { avg, min, max, dowAvg, bestDow, worstDow, bestAvg, worstAvg, trend, days: entries.length }
}

const WATCH_META: Record<string, { link: string; linkLabel: string }> = {
  'watch-den-cdg-sep26':    { link: 'https://www.google.com/travel/flights?q=nonstop+flights+from+denver+to+paris+september+2026', linkLabel: 'Google Flights' },
  'watch-celine-paris-sep26': { link: 'https://www.stubhub.com/celine-dion-tickets/performer/7790', linkLabel: 'StubHub' },
  'watch-den-bwi-aug26':    { link: 'https://www.google.com/travel/flights?q=nonstop+flights+from+denver+to+baltimore+august+8+2026', linkLabel: 'Google Flights' },
  'watch-den-las-nov26':    { link: 'https://www.google.com/travel/flights?q=nonstop+flights+from+denver+to+las+vegas+november+13+2026', linkLabel: 'Google Flights' },
  'watch-lisa-vegas-nov26': { link: 'https://www.stubhub.com/lisa-blackpink-tickets/performer/150420309', linkLabel: 'StubHub' },
}

const FLIGHT_IDS = ['watch-den-cdg-sep26', 'watch-den-bwi-aug26', 'watch-den-las-nov26']

// ─── Compact flight card (top row) ──────────────────────────────────────────
function FlightCard({ watch, onPriceLogged }: { watch: TravelWatch; onPriceLogged: () => void }) {
  const [logging, setLogging] = useState(false)
  const [form, setForm] = useState({ price: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const meta = WATCH_META[watch.id] ?? { link: '#', linkLabel: 'Search' }
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
        body: JSON.stringify({ price: parseFloat(form.price), stops: 'nonstop', notes: form.notes || undefined }),
      })
      if (res.ok) { setLogging(false); setForm({ price: '', notes: '' }); onPriceLogged() }
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Plane size={13} className="text-neutral-500" />
          <span className="text-xs font-semibold text-white truncate">{watch.label}</span>
        </div>
        <a href={meta.link} target="_blank" rel="noopener noreferrer"
          className="text-neutral-700 hover:text-neutral-400 transition-colors shrink-0">
          <ExternalLink size={11} />
        </a>
      </div>

      {/* Today's prices — compact list */}
      {latest.length > 0 ? (
        <div className="space-y-0.5">
          {latest.map((p, i) => (
            <div key={p.id ?? i} className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{fmtPrice(p.price)}</span>
              {typeof p.details?.airline === 'string' && p.details.airline && (
                <span className="text-[10px] text-neutral-600">{p.details.airline}</span>
              )}
            </div>
          ))}
        </div>
      ) : watch.latest_price != null ? (
        <p className="text-xl font-bold text-white">{fmtPrice(watch.latest_price)}</p>
      ) : (
        <p className="text-xs text-neutral-600 flex items-center gap-1"><TrendingDown size={12} /> No data yet</p>
      )}

      {/* Analytics strip */}
      {analytics && analytics.days >= 3 && (
        <div className="pt-2 border-t border-neutral-800 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Avg <span className="text-neutral-300 font-medium">{fmtPrice(analytics.avg)}</span></span>
            <span className="text-emerald-400">Low {fmtPrice(analytics.min)}</span>
            <span className="text-rose-400">High {fmtPrice(analytics.max)}</span>
          </div>

          {/* Mini bar chart */}
          <div className="flex items-end gap-0.5 h-10">
            {analytics.dowAvg.map((avg, i) => {
              if (avg === null) return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
                  <div className="w-full bg-neutral-800/20 rounded-t-sm" style={{ height: '3px' }} />
                  <span className="text-[9px] text-neutral-800">{DAYS[i][0]}</span>
                </div>
              )
              const pct = analytics.max > analytics.min ? ((avg - analytics.min) / (analytics.max - analytics.min)) * 70 + 10 : 40
              const isBest = i === analytics.bestDow
              const isWorst = i === analytics.worstDow
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
                  <div className={`w-full rounded-t-sm ${isBest ? 'bg-emerald-500' : isWorst ? 'bg-rose-500' : 'bg-neutral-600'}`}
                    style={{ height: `${pct}%` }} />
                  <span className={`text-[9px] ${isBest ? 'text-emerald-500' : isWorst ? 'text-rose-500' : 'text-neutral-700'}`}>
                    {DAYS[i][0]}
                  </span>
                </div>
              )
            })}
          </div>

          {analytics.bestDow >= 0 && (
            <p className="text-[10px] text-emerald-400">Best: {DAYS[analytics.bestDow]} · {fmtPrice(analytics.bestAvg)} avg
              {analytics.trend === 'down' && ' · ↓ trending down'}
              {analytics.trend === 'up' && <span className="text-rose-400"> · ↑ trending up</span>}
            </p>
          )}
        </div>
      )}

      {/* Manual log */}
      {logging ? (
        <form onSubmit={submitPrice} className="flex items-center gap-1.5">
          <input type="number" min="1" step="1" placeholder="$" value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
            autoFocus required />
          <input type="text" placeholder="Airline" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none" />
          <button type="submit" disabled={saving} className="text-neutral-300 hover:text-white"><Check size={12} /></button>
          <button type="button" onClick={() => setLogging(false)} className="text-neutral-700"><X size={12} /></button>
        </form>
      ) : (
        <button onClick={() => setLogging(true)}
          className="flex items-center gap-1 text-[10px] text-neutral-700 hover:text-neutral-400 transition-colors">
          <PlusCircle size={10} /> Log price
        </button>
      )}
    </div>
  )
}

// ─── Full ticket card (bottom row) ──────────────────────────────────────────
function TicketCard({ watch, onPriceLogged }: { watch: TravelWatch; onPriceLogged: () => void }) {
  const [logging, setLogging] = useState(false)
  const [form, setForm] = useState({ price: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const meta = WATCH_META[watch.id] ?? { link: '#', linkLabel: 'Search' }
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
        body: JSON.stringify({ price: parseFloat(form.price), notes: form.notes || undefined }),
      })
      if (res.ok) { setLogging(false); setForm({ price: '', notes: '' }); onPriceLogged() }
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ticket size={15} className="text-neutral-500" />
          <div>
            <h2 className="text-sm font-semibold text-white">{watch.label}</h2>
            <p className="text-xs text-neutral-600 mt-0.5">ticket</p>
          </div>
        </div>
        <a href={meta.link} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-300 transition-colors">
          {meta.linkLabel} <ExternalLink size={11} />
        </a>
      </div>

      {latest.length > 0 ? (
        <div className="space-y-1">
          {latest.map((p, i) => (
            <div key={p.id ?? i} className="flex items-center justify-between bg-neutral-800/40 rounded px-3 py-1.5">
              <span className="text-base font-bold text-white">{fmtPrice(p.price)}</span>
              {typeof p.details?.notes === 'string' && p.details.notes && (
                <span className="text-xs text-neutral-500">{p.details.notes}</span>
              )}
            </div>
          ))}
        </div>
      ) : watch.latest_price != null ? (
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-white">{fmtPrice(watch.latest_price)}</span>
          <span className="text-sm text-neutral-500 mb-0.5">current best</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-neutral-600">
          <TrendingDown size={15} /><span className="text-sm">No data yet</span>
        </div>
      )}

      {analytics && analytics.days >= 3 && (
        <div className="space-y-3 pt-1 border-t border-neutral-800">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-neutral-600">Avg</p><p className="text-sm font-semibold text-neutral-300">{fmtPrice(analytics.avg)}</p></div>
            <div><p className="text-xs text-neutral-600">Low</p><p className="text-sm font-semibold text-emerald-400">{fmtPrice(analytics.min)}</p></div>
            <div><p className="text-xs text-neutral-600">High</p><p className="text-sm font-semibold text-rose-400">{fmtPrice(analytics.max)}</p></div>
          </div>
          <div className="flex items-end gap-1 h-12">
            {analytics.dowAvg.map((avg, i) => {
              if (avg === null) return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <div className="w-full bg-neutral-800/20 rounded-t-sm" style={{ height: '3px' }} />
                  <span className="text-[10px] text-neutral-700">{DAYS[i]}</span>
                </div>
              )
              const pct = analytics.max > analytics.min ? ((avg - analytics.min) / (analytics.max - analytics.min)) * 70 + 10 : 40
              const isBest = i === analytics.bestDow
              const isWorst = i === analytics.worstDow
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <div className={`w-full rounded-t-sm ${isBest ? 'bg-emerald-500' : isWorst ? 'bg-rose-500' : 'bg-neutral-600'}`}
                    style={{ height: `${pct}%` }} />
                  <span className={`text-[10px] ${isBest ? 'text-emerald-400' : isWorst ? 'text-rose-400' : 'text-neutral-600'}`}>{DAYS[i]}</span>
                </div>
              )
            })}
          </div>
          {analytics.bestDow >= 0 && (
            <p className="text-[10px] text-neutral-500">
              <span className="text-emerald-400">Best: {DAYS[analytics.bestDow]} · {fmtPrice(analytics.bestAvg)} avg</span>
              {analytics.trend === 'down' && ' · ↓ trending down'}
              {analytics.trend === 'up' && <span className="text-rose-400"> · ↑ trending up</span>}
              {' '}· {analytics.days}d data
            </p>
          )}
        </div>
      )}

      {logging ? (
        <form onSubmit={submitPrice} className="flex items-center gap-2">
          <input type="number" min="1" step="1" placeholder="$" value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
            autoFocus required />
          <input type="text" placeholder="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none" />
          <button type="submit" disabled={saving} className="text-neutral-300 hover:text-white"><Check size={13} /></button>
          <button type="button" onClick={() => setLogging(false)} className="text-neutral-600"><X size={13} /></button>
        </form>
      ) : (
        <button onClick={() => setLogging(true)}
          className="flex items-center gap-1.5 text-xs text-neutral-700 hover:text-neutral-400 transition-colors">
          <PlusCircle size={11} /> Log price manually
        </button>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
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
    } finally { setChecking(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="flex items-center justify-center py-24 text-neutral-500 text-sm">Loading…</div>
  if (error) return <div className="space-y-4"><h1 className="text-2xl font-bold text-white">Travel</h1><p className="text-sm text-red-400">{error}</p></div>

  const watches = data?.watches ?? []
  const flights = watches.filter(w => FLIGHT_IDS.includes(w.id))
  const tickets = watches.filter(w => !FLIGHT_IDS.includes(w.id))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Travel</h1>
          <p className="mt-1 text-sm text-neutral-500">Nonstop only · updated daily at 9am</p>
        </div>
        <button onClick={runCheck} disabled={checking}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Checking…' : 'Run Check'}
        </button>
      </div>

      {/* 3 flight cards across the top */}
      {flights.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {flights.map(w => <FlightCard key={w.id} watch={w} onPriceLogged={load} />)}
        </div>
      )}

      {/* Ticket watches below */}
      {tickets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {tickets.map(w => <TicketCard key={w.id} watch={w} onPriceLogged={load} />)}
        </div>
      )}
    </div>
  )
}
