export const dynamic = 'force-dynamic'

import { api } from '@/lib/api'
import { Flame, Clock, Trophy, TrendingUp, Lightbulb, Cpu, CheckCircle, AlertCircle } from 'lucide-react'

async function getData() {
  const [workoutsRes, healthRes, lightsRes, stateRes] = await Promise.allSettled([
    api.workouts.list(),
    api.health(),
    api.home.lights(),
    api.home.state(),
  ])
  return {
    workouts: workoutsRes.status === 'fulfilled' ? workoutsRes.value : null,
    health: healthRes.status === 'fulfilled' ? healthRes.value : null,
    lights: lightsRes.status === 'fulfilled' ? lightsRes.value : null,
    haState: stateRes.status === 'fulfilled' ? stateRes.value : null,
  }
}

export default async function DashboardPage() {
  const { workouts, health, lights, haState } = await getData()

  const stats = workouts?.stats
  const recentWorkouts = workouts?.workouts?.slice(0, 5) ?? []

  const allLights = lights?.lights ?? []
  const lightsOn = allLights.filter(l => l.state === 'on')
  const lightsOff = allLights.filter(l => l.state === 'off')
  const totalDevices = haState?.count ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-400">Personal automation hub overview</p>
      </div>

      {/* Story banner */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Built different</p>
            <h2 className="text-lg font-semibold text-white leading-snug">
              10 years of "I should build this." Built in 10 hours with AI.
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl">
              This entire stack — Go API, Python scraper, Next.js frontend, PostgreSQL, Redis, two AI agents,
              production deployment — was designed and built through Claude Code conversations.
              Not vibe-coded. Architected. Every ADR written, every decision traceable.
              Running on a <span className="text-neutral-300">2015 MacBook Pro (16GB RAM, 500GB SSD, worth ~$100)</span> rescued from obsolescence,
              hosted behind a UniFi router. Home Assistant runs on a <span className="text-neutral-300">Raspberry Pi</span> controlling {totalDevices ? `${totalDevices} smart devices` : 'the entire home'}.
              A software engineer embracing AI — not replacing craft, but amplifying it.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                'Go + Gin API',
                'Next.js 14 App Router',
                'Claude Sonnet ReAct agent',
                'WebSocket chat → controls Home Assistant',
                'Playwright scraper',
                'Caddy + Cloudflare',
                '505 smart devices',
              ].map(tag => (
                <span key={tag} className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                  {tag}
                </span>
              ))}
            </div>
            <a href="/journey" className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors">
              See the full build journey →
            </a>
          </div>
        </div>
      </section>

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

      {/* Home */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">Home</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
          <StatCard
            icon={<Cpu size={18} className="text-cyan-400" />}
            label="Smart Devices"
            value={totalDevices ? totalDevices.toLocaleString() : '—'}
          />
          <StatCard
            icon={<Lightbulb size={18} className="text-yellow-400" />}
            label="Lights On"
            value={allLights.length ? `${lightsOn.length} / ${allLights.length}` : '—'}
          />
        </div>
        {lightsOn.length > 0 && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-3">Currently On</p>
            <div className="flex flex-wrap gap-2">
              {lightsOn.map(l => (
                <span key={l.entity_id} className="flex items-center gap-1.5 rounded-full border border-yellow-800/40 bg-yellow-900/20 px-3 py-1 text-xs text-yellow-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  {(l.attributes?.friendly_name as string) ?? l.entity_id}
                </span>
              ))}
            </div>
          </div>
        )}
        {lightsOn.length === 0 && allLights.length > 0 && (
          <p className="text-sm text-neutral-500">All lights off.</p>
        )}
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
