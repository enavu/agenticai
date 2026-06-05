import { useState } from 'react'
import { Calendar, Target, TrendingUp, Plane, Pencil, Check, X } from 'lucide-react'

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function weeksUntil(days) {
  return Math.max(1, Math.ceil(days / 7))
}

export function TripCard({ trip, onFlightUpdate }) {
  const [editingFlight, setEditingFlight] = useState(false)
  const [flightPrice, setFlightPrice] = useState(trip.flight_price_usd ?? '')
  const [flightNotes, setFlightNotes] = useState(trip.flight_notes ?? '')
  const [saving, setSaving] = useState(false)

  async function saveFlight() {
    setSaving(true)
    try {
      const res = await fetch(`/api/trips/${trip.id}/flight`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flight_price_usd: flightPrice ? parseFloat(flightPrice) : null,
          flight_notes: flightNotes || null,
        }),
      })
      if (res.ok) {
        const { trip: updated } = await res.json()
        onFlightUpdate?.(updated)
        setEditingFlight(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const saved = parseFloat(trip.total_saved || trip.saved_usd || 0)
  const budget = parseFloat(trip.budget_usd)
  const remaining = Math.max(0, budget - saved)
  const pct = Math.min(100, Math.round((saved / budget) * 100))
  const days = daysUntil(trip.date)
  const weeks = weeksUntil(days)
  const weeklyNeeded = (remaining / weeks).toFixed(2)

  const isOnTrack = saved / budget >= (1 - days / 365)

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{trip.emoji}</span>
            <h3 className="font-semibold text-white text-base">{trip.name}</h3>
          </div>
          {trip.subtitle && (
            <p className="text-xs text-gray-500 mt-0.5 ml-9">{trip.subtitle}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
            isOnTrack
              ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
              : 'text-amber-400 bg-amber-950/40 border-amber-800/50'
          }`}>
            {isOnTrack ? '✓ On track' : '⚠ Behind'}
          </span>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar size={11} />
            <span>{days}d away</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500">
          <span>${saved.toFixed(0)} saved</span>
          <span>${budget.toFixed(0)} goal</span>
        </div>
        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct >= 75 ? 'bg-emerald-500' :
              pct >= 40 ? 'bg-amber-500' :
              'bg-rose-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 text-right">{pct}% funded</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/60 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <Target size={11} />
            <span>Still needed</span>
          </div>
          <p className="text-lg font-bold text-white">${remaining.toFixed(0)}</p>
        </div>
        <div className="bg-gray-800/60 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <TrendingUp size={11} />
            <span>Weekly save</span>
          </div>
          <p className="text-lg font-bold text-white">${weeklyNeeded}</p>
        </div>
      </div>

      {/* Flight price */}
      {editingFlight ? (
        <div className="flex items-center gap-2 pt-1">
          <Plane size={12} className="text-sky-400 shrink-0" />
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Price $"
            value={flightPrice}
            onChange={e => setFlightPrice(e.target.value)}
            className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            autoFocus
          />
          <input
            type="text"
            placeholder="Notes (e.g. non-stop)"
            value={flightNotes}
            onChange={e => setFlightNotes(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button onClick={saveFlight} disabled={saving} className="text-emerald-400 hover:text-emerald-300">
            <Check size={13} />
          </button>
          <button onClick={() => { setEditingFlight(false); setFlightPrice(trip.flight_price_usd ?? ''); setFlightNotes(trip.flight_notes ?? '') }} className="text-gray-600 hover:text-gray-400">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-1">
          {trip.flight_price_usd ? (
            <div className="flex items-center gap-1.5 text-xs text-sky-400">
              <Plane size={11} />
              <span className="font-medium">${parseFloat(trip.flight_price_usd).toFixed(0)}</span>
              {trip.flight_notes && <span className="text-sky-400/60">· {trip.flight_notes}</span>}
            </div>
          ) : (
            <span className="text-xs text-gray-700">No flight logged</span>
          )}
          <button
            onClick={() => setEditingFlight(true)}
            className="text-gray-700 hover:text-gray-400 transition-colors"
            title="Log flight price"
          >
            <Pencil size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

// Combined progress bar across all trips
export function AllTripsProgress({ trips }) {
  const totalBudget = trips.reduce((s, t) => s + parseFloat(t.budget_usd), 0)
  const totalSaved = trips.reduce((s, t) => s + parseFloat(t.total_saved || t.saved_usd || 0), 0)
  const pct = totalBudget > 0 ? Math.round((totalSaved / totalBudget) * 100) : 0

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">All Trips — Combined</h3>
        <span className="text-sm text-gray-400">{pct}% funded</span>
      </div>
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex">
        {trips.map((t, i) => {
          const saved = parseFloat(t.total_saved || t.saved_usd || 0)
          const tripPct = totalBudget > 0 ? (saved / totalBudget) * 100 : 0
          const colors = ['bg-brand-500', 'bg-violet-500', 'bg-pink-500']
          return (
            <div
              key={t.id}
              className={`h-full ${colors[i % colors.length]} transition-all duration-500`}
              style={{ width: `${tripPct}%` }}
              title={`${t.name}: ${tripPct.toFixed(1)}%`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>${totalSaved.toFixed(0)} saved total</span>
        <span>${totalBudget.toFixed(0)} total budget</span>
      </div>
    </div>
  )
}
