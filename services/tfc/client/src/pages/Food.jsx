import { useEffect, useState } from 'react'
import { Flame, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { CoachResponse } from '../components/CoachResponse.jsx'

const FLAG_LABELS = {
  cholesterol: { label: 'Cholesterol', color: 'text-amber-400 bg-amber-950/40 border-amber-800/50' },
  sodium:      { label: 'High sodium', color: 'text-rose-400 bg-rose-950/40 border-rose-800/50' },
  fat:         { label: 'High fat',    color: 'text-orange-400 bg-orange-950/40 border-orange-800/50' },
  sugar:       { label: 'Sugar',       color: 'text-pink-400 bg-pink-950/40 border-pink-800/50' },
  carbs:       { label: 'Carbs',       color: 'text-purple-400 bg-purple-950/40 border-purple-800/50' },
}

function FoodEntryRow({ entry, onDelete }) {
  const flags = Array.isArray(entry.flags) ? entry.flags : (JSON.parse(entry.flags || '[]'))
  const isDoorDash = entry.source === 'doordash'

  return (
    <div className={`flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-800/50 ${isDoorDash ? 'bg-rose-950/10' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isDoorDash && <AlertTriangle size={12} className="text-rose-400 shrink-0" />}
          <p className="text-sm font-medium text-gray-200 truncate">{entry.meal_name}</p>
          {entry.calories && (
            <span className="text-xs text-gray-500">{entry.calories} cal</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">
            {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${
            isDoorDash
              ? 'text-rose-400 bg-rose-950/40 border-rose-800/50'
              : 'text-gray-500 bg-gray-800/50 border-gray-700/50'
          }`}>
            {isDoorDash ? '🛵 DoorDash' : entry.source}
          </span>
          {flags.map(f => {
            const config = FLAG_LABELS[f]
            if (!config) return null
            return (
              <span key={f} className={`text-xs px-1.5 py-0.5 rounded border ${config.color}`}>
                {config.label}
              </span>
            )
          })}
        </div>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="text-gray-600 hover:text-rose-400 transition-colors mt-0.5 shrink-0"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export default function Food() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ meal_name: '', calories: '', date: '' })
  const [submitting, setSubmitting] = useState(false)
  const [days, setDays] = useState(7)

  async function load() {
    setLoading(true)
    fetch(`/api/food?days=${days}`)
      .then(r => r.json())
      .then(d => setEntries(d.entries || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [days])

  async function addEntry(e) {
    e.preventDefault()
    if (!form.meal_name) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_name: form.meal_name,
          calories: form.calories ? parseInt(form.calories) : undefined,
          date: form.date || undefined,
        }),
      })
      if (res.ok) {
        setForm({ meal_name: '', calories: '', date: '' })
        await load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteEntry(id) {
    await fetch(`/api/food/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  // Flag counts for the week
  const flagCounts = entries.reduce((acc, e) => {
    const flags = Array.isArray(e.flags) ? e.flags : (JSON.parse(e.flags || '[]'))
    flags.forEach(f => { acc[f] = (acc[f] || 0) + 1 })
    return acc
  }, {})

  const doorDashCount = entries.filter(e => e.source === 'doordash').length
  const totalCals = entries.reduce((s, e) => s + (e.calories || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Food Log</h1>
        <select
          value={days}
          onChange={e => setDays(parseInt(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
          <p className="text-xs text-gray-500">Logged meals</p>
          <p className="text-2xl font-bold text-white mt-1">{entries.length}</p>
        </div>
        <div className={`rounded-xl border p-3 ${doorDashCount > 0 ? 'border-rose-800/50 bg-rose-950/20' : 'border-gray-800 bg-gray-900'}`}>
          <p className="text-xs text-gray-500">DoorDash meals</p>
          <p className={`text-2xl font-bold mt-1 ${doorDashCount > 0 ? 'text-rose-400' : 'text-white'}`}>{doorDashCount}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
          <p className="text-xs text-gray-500">Tracked cals</p>
          <p className="text-2xl font-bold text-white mt-1">{totalCals.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
          <p className="text-xs text-gray-500">Avg per logged</p>
          <p className="text-2xl font-bold text-white mt-1">
            {entries.filter(e => e.calories).length > 0
              ? Math.round(totalCals / entries.filter(e => e.calories).length)
              : '—'}
          </p>
        </div>
      </div>

      {/* Nutrition flags summary */}
      {Object.keys(flagCounts).length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={14} className="text-orange-400" />
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nutrition flags this week</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(flagCounts).map(([flag, count]) => {
              const config = FLAG_LABELS[flag]
              if (!config) return null
              return (
                <span key={flag} className={`text-xs px-2.5 py-1 rounded-full border ${config.color}`}>
                  {config.label} ×{count}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Coach */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Check my diet</h2>
        <CoachResponse
          promptType="food"
          label="Assess my eating habits"
        />
      </div>

      {/* Manual entry form */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Log a meal</h3>
        <form onSubmit={addEntry} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="What did you eat?"
            value={form.meal_name}
            onChange={e => setForm(f => ({ ...f, meal_name: e.target.value }))}
            className="sm:col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
            required
          />
          <input
            type="number"
            placeholder="Calories (optional)"
            value={form.calories}
            onChange={e => setForm(f => ({ ...f, calories: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add meal'}
          </button>
        </form>
        <p className="text-xs text-gray-600">Nutrition flags are auto-detected from the meal name. DoorDash imports auto-populate here.</p>
      </div>

      {/* Log */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No entries yet. Log a meal above or import DoorDash CSV.</p>
        ) : (
          <div>
            <div className="bg-gray-800/50 px-4 py-2 text-xs text-gray-500 uppercase tracking-wide">
              {entries.length} entries
            </div>
            {entries.map(e => (
              <FoodEntryRow key={e.id} entry={e} onDelete={deleteEntry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
