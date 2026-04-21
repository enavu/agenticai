'use client'

import { useState, useEffect } from 'react'
import { api, type Workout, type WorkoutStats } from '@/lib/api'
import { RefreshCw, Flame, Clock, Trophy, Zap } from 'lucide-react'

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [stats, setStats] = useState<WorkoutStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api.workouts.list()
      setWorkouts(res.workouts ?? [])
      setStats(res.stats)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await api.workouts.sync()
      setSyncResult(`Synced ${res.synced} workouts (${res.skipped} skipped)`)
      await load()
    } catch (e: any) {
      setSyncResult('Sync failed: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => { load() }, [])

  const maxCalsWorkout = workouts.length > 0
    ? workouts.reduce((best, w) => (w.cals_burned ?? 0) > (best?.cals_burned ?? 0) ? w : best, workouts[0])
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workouts</h1>
          <p className="text-sm text-neutral-400 mt-1">Cyclebar ride history</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync from Cyclebar'}
        </button>
      </div>

      {syncResult && (
        <div className="rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm text-neutral-300">
          {syncResult}
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} className="text-yellow-400" />
              <span className="text-xs text-neutral-400">Total Rides</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_workouts}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame size={16} className="text-orange-400" />
              <span className="text-xs text-neutral-400">Total Calories</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_calories.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-blue-400" />
              <span className="text-xs text-neutral-400">Hours</span>
            </div>
            <p className="text-2xl font-bold">{Math.round(stats.total_minutes / 60)}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-xs text-neutral-400">Cal PR</span>
            </div>
            <p className="text-2xl font-bold">{maxCalsWorkout?.cals_burned ?? '—'}</p>
            {maxCalsWorkout?.cals_burned && (
              <p className="text-xs text-neutral-500 mt-0.5">
                {new Date(maxCalsWorkout.class_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-neutral-800 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-neutral-500 text-sm">Loading…</div>
        ) : workouts.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-sm">
            No workouts yet. Click "Sync from Cyclebar" to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Class</th>
                <th className="px-4 py-2.5 text-left">Instructor</th>
                <th className="px-4 py-2.5 text-left">Studio</th>
                <th className="px-4 py-2.5 text-right">Cals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {workouts.map((w) => (
                <tr key={w.id} className="bg-neutral-950 hover:bg-neutral-900 transition-colors">
                  <td className="px-4 py-2.5 text-neutral-400">
                    {new Date(w.class_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-white">{w.class_name}</td>
                  <td className="px-4 py-2.5 text-neutral-300">{w.instructor || '—'}</td>
                  <td className="px-4 py-2.5 text-neutral-400">{w.studio || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-orange-400">{w.cals_burned ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
