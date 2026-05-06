'use client'

import { useEffect, useState } from 'react'
import { api, TravelData, TravelWatch } from '@/lib/api'
import { Plane, Ticket, TrendingDown, ExternalLink, RefreshCw } from 'lucide-react'

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

function WatchCard({ watch }: { watch: TravelWatch }) {
  const meta = WATCH_META[watch.id] ?? {
    icon: <Ticket size={18} className="text-neutral-400" />,
    color: 'text-neutral-400',
    link: '#',
    linkLabel: 'Search',
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
                  const detailStr = p.details
                    ? Object.entries(p.details)
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')
                    : ''
                  return (
                    <tr key={p.id} className="bg-neutral-950 hover:bg-neutral-900 transition-colors">
                      <td className="px-3 py-2 text-neutral-400">{fmtDate(p.checked_at)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${meta.color}`}>
                        {fmtPrice(p.price)}
                      </td>
                      <td className="px-3 py-2 text-neutral-600 text-xs truncate max-w-[180px]">
                        {detailStr || '—'}
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
            <WatchCard key={w.id} watch={w} />
          ))}
        </div>
      )}
    </div>
  )
}
