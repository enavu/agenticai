'use client'

import { useEffect, useState } from 'react'
import { api, TravelData, TravelWatch } from '@/lib/api'
import { Plane, Ticket, TrendingDown, ExternalLink, RefreshCw, PlusCircle, Check, X } from 'lucide-react'

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const WATCH_META: Record<string, { icon: React.ReactNode; color: string; link: string; linkLabel: string }> = {
  'watch-den-cdg-sep26': {
    icon: <Plane size={18} className="text-blue-400" />,
    color: 'text-blue-400',
    link: 'https://www.google.com/travel/flights?q=flights+from+denver+to+paris+september+2026',
    linkLabel: 'Search on Google Flights',
  },
  'watch-celine-paris-sep26': {
    icon: <Ticket size={18} className="text-violet-400" />,
    color: 'text-violet-400',
    link: 'https://www.stubhub.com/celine-dion-tickets/performer/7790',
    linkLabel: 'Search on StubHub',
  },
  'watch-den-bwi-aug26': {
    icon: <Plane size={18} className="text-emerald-400" />,
    color: 'text-emerald-400',
    link: 'https://www.google.com/travel/flights?q=flights+from+denver+to+baltimore+august+8+2026',
    linkLabel: 'Search on Google Flights',
  },
  'watch-den-las-nov26': {
    icon: <Plane size={18} className="text-amber-400" />,
    color: 'text-amber-400',
    link: 'https://www.google.com/travel/flights?q=flights+from+denver+to+las+vegas+november+13+2026',
    linkLabel: 'Search on Google Flights',
  },
  'watch-lisa-vegas-nov26': {
    icon: <Ticket size={18} className="text-pink-400" />,
    color: 'text-pink-400',
    link: 'https://www.stubhub.com/lisa-blackpink-tickets/performer/150420309',
    linkLabel: 'Search on StubHub',
  },
}

function stopsBadge(stops: string) {
  if (!stops || stops === 'unknown') return null
  const color = stops === 'nonstop'
    ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
    : 'text-amber-400 bg-amber-950/40 border-amber-800/50'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${color}`}>
      {stops}
    </span>
  )
}

function WatchCard({ watch, onPriceLogged }: { watch: TravelWatch; onPriceLogged: () => void }) {
  const [logging, setLogging] = useState(false)
  const [form, setForm] = useState({ price: '', stops: 'nonstop', notes: '' })
  const [saving, setSaving] = useState(false)

  const meta = WATCH_META[watch.id] ?? {
    icon: <Ticket size={18} className="text-neutral-400" />,
    color: 'text-neutral-400',
    link: '#',
    linkLabel: 'Search',
  }

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
            <p className="text-xs text-neutral-500 mt-0.5 capitalize">{watch.type}</p>
          </div>
        </div>
        <a
          href={meta.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
        >
          {meta.linkLabel}
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Current best price */}
      {watch.latest_price != null ? (
        <div className="flex items-end gap-2">
          <span className={`text-4xl font-bold ${meta.color}`}>
            {fmtPrice(watch.latest_price)}
          </span>
          <span className="text-sm text-neutral-500 mb-1">current best</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-neutral-500">
          <TrendingDown size={16} />
          <span className="text-sm">No price data yet — check back after the first daily run</span>
        </div>
      )}

      {/* Manual log form */}
      {logging ? (
        <form onSubmit={submitPrice} className="flex items-center gap-2 pt-1">
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Price $"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-24 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            autoFocus
            required
          />
          <select
            value={form.stops}
            onChange={e => setForm(f => ({ ...f, stops: e.target.value }))}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
          >
            <option value="nonstop">Nonstop</option>
            <option value="1 stop">1 stop</option>
            <option value="2 stops">2 stops</option>
          </select>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button type="submit" disabled={saving} className="text-emerald-400 hover:text-emerald-300">
            <Check size={14} />
          </button>
          <button type="button" onClick={() => setLogging(false)} className="text-neutral-600 hover:text-neutral-400">
            <X size={14} />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setLogging(true)}
          className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
        >
          <PlusCircle size={12} />
          Log a price manually
        </button>
      )}

      {/* Price history table */}
      {watch.history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">Price history (30 days)</p>
          <div className="rounded-md border border-neutral-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-950 text-neutral-500 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-left text-neutral-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {watch.history.map((p) => {
                  const stops = p.details?.stops as string | undefined
                  const notes = p.details?.notes as string | undefined
                  const source = p.details?.source as string | undefined
                  const detailParts = [
                    p.details?.type,
                    notes,
                    source === 'manual' ? 'manual' : undefined,
                  ].filter(Boolean).join(' · ')
                  return (
                    <tr key={p.id} className="bg-neutral-950 hover:bg-neutral-900 transition-colors">
                      <td className="px-3 py-2 text-neutral-400">{fmtDate(p.checked_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {stops && stopsBadge(stops)}
                          <span className={`font-medium ${meta.color}`}>{fmtPrice(p.price)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-neutral-600 text-xs truncate max-w-[180px]">
                        {detailParts || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
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

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-neutral-500 text-sm">Loading…</div>
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Travel</h1>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  const watches = data?.watches ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Travel</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Price tracker — updated daily at 9am
          </p>
        </div>
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Checking…' : 'Run Check'}
        </button>
      </div>

      {watches.length === 0 ? (
        <p className="text-sm text-neutral-500">No watches configured.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {watches.map((w) => (
            <WatchCard key={w.id} watch={w} onPriceLogged={load} />
          ))}
        </div>
      )}
    </div>
  )
}
