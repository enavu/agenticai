import { useEffect, useState } from 'react'
import { TripCard, AllTripsProgress } from '../components/TripCard.jsx'
import { CoachResponse } from '../components/CoachResponse.jsx'
import { MoodSelector } from '../components/MoodToggle.jsx'
import { PlusCircle, Loader2 } from 'lucide-react'

export default function Dashboard() {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingModal, setSavingModal] = useState(null) // trip id
  const [saveForm, setSaveForm] = useState({ amount: '', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/trips')
      .then(r => r.json())
      .then(d => setTrips(d.trips || []))
      .finally(() => setLoading(false))
  }, [])

  async function logSavings(e) {
    e.preventDefault()
    if (!saveForm.amount || !savingModal) return
    setSaving(true)
    try {
      const res = await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: savingModal,
          amount: parseFloat(saveForm.amount),
          note: saveForm.note,
        }),
      })
      if (res.ok) {
        // Refresh trips
        const updated = await fetch('/api/trips').then(r => r.json())
        setTrips(updated.trips || [])
        setSavingModal(null)
        setSaveForm({ amount: '', note: '' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Mood selector */}
      <section className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">What's the vibe?</p>
        <MoodSelector />
      </section>

      {/* Combined progress */}
      {trips.length > 0 && <AllTripsProgress trips={trips} />}

      {/* Trip cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Your Trips</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map(trip => (
            <div key={trip.id} className="space-y-2">
              <TripCard
                trip={trip}
                onFlightUpdate={updated => setTrips(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))}
              />
              <button
                onClick={() => setSavingModal(trip.id)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-dashed border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
              >
                <PlusCircle size={12} />
                Log savings toward this trip
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Coach section */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Am I on track?</h2>
        <CoachResponse
          promptType="trips"
          label="Get my trip assessment"
        />
      </section>

      {/* Log savings modal */}
      {savingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-white">
              Log savings toward {trips.find(t => t.id === savingModal)?.emoji} {trips.find(t => t.id === savingModal)?.name}
            </h3>
            <form onSubmit={logSavings} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Amount ($)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="50.00"
                  value={saveForm.amount}
                  onChange={e => setSaveForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. skipped DoorDash this week 🎉"
                  value={saveForm.note}
                  onChange={e => setSaveForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setSavingModal(null); setSaveForm({ amount: '', note: '' }) }}
                  className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-sm text-white font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Log it'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
