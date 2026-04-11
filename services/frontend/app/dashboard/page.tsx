export const dynamic = 'force-dynamic'

import { api } from '@/lib/api'
import { Flame, Clock, Trophy, TrendingUp, Home, CheckCircle, AlertCircle } from 'lucide-react'

async function getData() {
  const [workoutsRes, healthRes] = await Promise.allSettled([
    api.workouts.list(),
    api.health(),
  ])
  return {
    workouts: workoutsRes.status === 'fulfilled' ? workoutsRes.value : null,
    health: healthRes.status === 'fulfilled' ? healthRes.value : null,
  }
}

export default async function DashboardPage() {
  const { workouts, health } = await getData()

  const stats = workouts?.stats
  const recentWorkouts = workouts?.workouts?.slice(0, 5) ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-400">Personal automation hub overview</p>
      </div>

      {/* System status */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">System Status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['db', 'ha', 'scraper'] as const).map((svc) => {
            const val = health?.[svc] ?? 'unknown'
            const ok = val === 'ok'
            return (
              <div key={svc} className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
                {ok
                  ? <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                  : <AlertCircle size={16} className="text-red-400 shrink-0" />}
                <div>
                  <p className="text-xs text-neutral-400 uppercase">{svc}</p>
                  <p className={`text-sm font-medium ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ok ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Workout stats */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">Fitness Stats</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Trophy size={18} className="text-yellow-400" />}
            label="Total Rides"
            value={stats?.total_workouts?.toString() ?? '—'}
          />
          <StatCard
            icon={<Flame size={18} className="text-orange-400" />}
            label="Total Calories"
            value={stats?.total_calories ? stats.total_calories.toLocaleString() : '—'}
          />
          <StatCard
            icon={<Clock size={18} className="text-blue-400" />}
            label="Total Hours"
            value={stats?.total_minutes ? `${Math.round(stats.total_minutes / 60)}h` : '—'}
          />
          <StatCard
            icon={<TrendingUp size={18} className="text-purple-400" />}
            label="This Month"
            value={stats?.workouts_this_month?.toString() ?? '—'}
          />
        </div>
      </section>

      {/* Recent workouts */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">Recent Workouts</h2>
        <div className="rounded-lg border border-neutral-800 overflow-hidden">
          {recentWorkouts.length === 0 ? (
            <div className="py-8 text-center text-neutral-500 text-sm">
              No workouts yet. <a href="/workouts" className="text-blue-400 hover:underline">Sync from Cyclebar →</a>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Class</th>
                  <th className="px-4 py-2 text-left">Instructor</th>
                  <th className="px-4 py-2 text-right">Cals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {recentWorkouts.map((w) => (
                  <tr key={w.id} className="bg-neutral-950 hover:bg-neutral-900 transition-colors">
                    <td className="px-4 py-2.5 text-neutral-400">
                      {new Date(w.class_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-white">{w.class_name}</td>
                    <td className="px-4 py-2.5 text-neutral-400">{w.instructor || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-orange-400">
                      {w.cals_burned ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4">
      <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-neutral-400">{label}</p></div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}
