export const dynamic = 'force-dynamic'

import { api } from '@/lib/api'
import {
  Flame, Clock, Trophy, TrendingUp, Cpu, Brain,
  CheckCircle, AlertCircle, Plane, Ticket, Lock,
  Zap, Calendar, Target, Wifi, Sparkles,
} from 'lucide-react'

async function getData() {
  const [workoutsRes, healthRes, insightRes, energyRes] = await Promise.allSettled([
    api.workouts.list(),
    api.health(),
    api.workouts.insights(),
    fetch(
      (process.env.API_URL || 'http://api:8080') + '/api/v1/home/energy?history=false',
      { cache: 'no-store' }
    ).then(r => r.ok ? r.json() : null).catch(() => null),
  ])
  return {
    workouts: workoutsRes.status === 'fulfilled' ? workoutsRes.value : null,
    health: healthRes.status === 'fulfilled' ? healthRes.value : null,
    insight: insightRes.status === 'fulfilled' ? insightRes.value : null,
    energy: energyRes.status === 'fulfilled' ? energyRes.value : null,
  }
}

function getEnergyQuip(energy: any): string | null {
  if (!energy?.channels || !energy?.summary) return null
  const { channels, summary } = energy
  const ch = (id: number) => channels.find((c: any) => c.id === id)
  const furnace1 = ch(2)
  const furnace2 = ch(8)
  const nonMainsW: number = channels.filter((c: any) => !c.is_mains).reduce((s: number, c: any) => s + c.power_w, 0)
  const hvacW = (furnace1?.power_w ?? 0) + (furnace2?.power_w ?? 0)

  if (furnace1?.power_w > 500 && furnace2?.power_w > 500)
    return `Both furnaces running simultaneously (${Math.round(hvacW)}W). Colorado winters: 1 — efficiency: 0. 🥶`
  if (nonMainsW > 0 && hvacW / nonMainsW > 0.5)
    return `HVAC eating ${Math.round((hvacW / nonMainsW) * 100)}% of home power right now. Heat is the main character today.`
  if (summary.total_power_w < 300)
    return `Whole home drawing ${Math.round(summary.total_power_w)}W. The house is basically meditating. 🧘`
  return `Home pulling ${Math.round(summary.total_power_w)}W across ${channels.filter((c: any) => !c.is_mains && c.power_w > 5).length} active circuits right now.`
}

export default async function DashboardPage() {
  const { workouts, health, insight, energy } = await getData()

  const stats = workouts?.stats
  const patterns = insight?.patterns
  const energyQuip = getEnergyQuip(energy)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-400">Personal automation hub — built with AI, running at home</p>
      </div>

      {/* Story banner */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Built different</p>
          <h2 className="text-lg font-semibold text-white leading-snug">
            10 years of "I should build this." Built in 10 hours with AI.
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl">
            This entire stack — Go API, Python scraper, Next.js frontend, PostgreSQL, Redis, multiple AI agents,
            production deployment — designed and built through Claude Code conversations.
            Running on a <span className="text-neutral-300">Mac Mini (migration server)</span> behind a UniFi router.
            Home Assistant controls <span className="text-neutral-300">505+ smart devices</span> from a Raspberry Pi.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {['Go + Gin API', 'Next.js 14', 'Claude Sonnet AI agents', 'WebSocket → Home Assistant', 'Playwright scraper', 'Caddy + Cloudflare'].map(tag => (
              <span key={tag} className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                {tag}
              </span>
            ))}
          </div>
          <a href="/journey" className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            See the full build journey →
          </a>
        </div>
      </section>

      {/* Fun life stats */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide flex items-center gap-2">
          <Sparkles size={14} className="text-violet-400" /> Life in numbers
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FunStat
            emoji="🚴"
            label="Total rides"
            value={stats?.total_workouts ? `${stats.total_workouts}` : '—'}
            sub="at CycleBar"
          />
          <FunStat
            emoji="🔥"
            label="Calories torched"
            value={stats?.total_calories ? stats.total_calories.toLocaleString() : '—'}
            sub={stats?.total_calories ? `≈ ${Math.round(stats.total_calories / 250)} burritos` : 'keep riding'}
          />
          <FunStat
            emoji="🏠"
            label="Smart devices"
            value="505+"
            sub="all talking to each other"
          />
          <FunStat
            emoji="🤖"
            label="AI agents"
            value="5"
            sub="running 24/7"
          />
        </div>

        {/* Energy quip */}
        {energyQuip && (
          <div className="mt-3 rounded-lg border border-yellow-800/30 bg-yellow-950/10 px-4 py-3 flex items-start gap-2.5">
            <Zap size={15} className="text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-sm text-neutral-300">{energyQuip}</p>
          </div>
        )}

        {/* AI coach quip */}
        {insight?.summary && (
          <div className="mt-3 rounded-lg border border-violet-800/30 bg-violet-950/10 px-4 py-3 flex items-start gap-2.5">
            <Brain size={15} className="text-violet-400 mt-0.5 shrink-0" />
            <p className="text-sm text-neutral-300 italic">"{insight.summary}"</p>
          </div>
        )}
      </section>

      {/* System status */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">System Status</h2>
        <div className="grid grid-cols-3 gap-3">
          {(['db', 'ha', 'scraper'] as const).map((svc) => {
            const ok = health?.[svc] === 'ok'
            return (
              <div key={svc} className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
                {ok
                  ? <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                  : <AlertCircle size={16} className="text-red-400 shrink-0" />}
                <div>
                  <p className="text-xs text-neutral-400 uppercase">{svc === 'ha' ? 'Home Assistant' : svc === 'db' ? 'Database' : 'Scraper'}</p>
                  <p className={`text-sm font-medium ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ok ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Fitness summary */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">Fitness</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
          <StatCard icon={<Trophy size={18} className="text-yellow-400" />} label="Total Rides" value={stats?.total_workouts?.toString() ?? '—'} />
          <StatCard icon={<Flame size={18} className="text-orange-400" />} label="Total Calories" value={stats?.total_calories ? stats.total_calories.toLocaleString() : '—'} />
          <StatCard icon={<Clock size={18} className="text-blue-400" />} label="Hours on Bike" value={stats?.total_minutes ? `${Math.round(stats.total_minutes / 60)}h` : '—'} />
          <StatCard icon={<TrendingUp size={18} className="text-purple-400" />} label="This Month" value={stats?.workouts_this_month?.toString() ?? '—'} />
        </div>

        {patterns && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <PatternCard icon={<Target size={16} className="text-emerald-400" />} label="Current Streak" value={`${patterns.current_streak}d`} sub={patterns.current_streak >= 5 ? 'Keep it up' : patterns.current_streak === 0 ? 'Time to ride' : 'Building'} color="emerald" />
            <PatternCard icon={<Calendar size={16} className="text-amber-400" />} label="Days Missed" value={patterns.days_missed_this_month.toString()} sub="this month" color={patterns.days_missed_this_month > 15 ? 'red' : 'amber'} />
            <PatternCard icon={<Zap size={16} className="text-blue-400" />} label="Avg Gap" value={`${patterns.avg_days_between_workouts.toFixed(1)}d`} sub="between sessions" color="blue" />
          </div>
        )}
      </section>

      {/* Travel intelligence */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">Travel Intelligence</h2>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white font-semibold">5 trips being tracked by AI</p>
              <p className="text-sm text-neutral-400 mt-0.5">Price checks run daily at 9am · 30-day history stored</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400">Active</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { icon: <Plane size={14} className="text-blue-400" />, label: 'DEN → Paris', date: 'Sep 2026', stability: 'watching' },
              { icon: <Plane size={14} className="text-emerald-400" />, label: 'DEN → Baltimore', date: 'Aug 2026', stability: 'stable' },
              { icon: <Plane size={14} className="text-amber-400" />, label: 'DEN → Las Vegas', date: 'Nov 2026', stability: 'watching' },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-2.5 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2.5">
                {t.icon}
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{t.label}</p>
                  <p className="text-xs text-neutral-500">{t.date} · {t.stability === 'stable' ? <span className="text-emerald-400">Price stable ✓</span> : <span className="text-neutral-400">Tracking</span>}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-md bg-neutral-800/50 px-4 py-3">
            <p className="text-xs text-neutral-400 uppercase tracking-wide font-medium mb-1">Booking insight</p>
            <p className="text-sm text-neutral-300">
              For DEN→Baltimore (Aug): <span className="text-emerald-400">optimal booking window is now</span> — domestic routes historically peak 6–8 weeks before departure.
              International (Paris): still 3+ months out, watch for dips mid-week.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Lock size={13} className="text-neutral-500" />
            <p className="text-xs text-neutral-500">Live prices, full history, and ticket tracking — <a href="/login" className="text-blue-400 hover:text-blue-300">login to see details</a></p>
          </div>
        </div>
      </section>

      {/* Smart home KPI board */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">Smart Home · Pattern Board</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
          <StatCard icon={<Cpu size={18} className="text-cyan-400" />} label="Smart Devices" value="505+" />
          <StatCard icon={<Wifi size={18} className="text-blue-400" />} label="Automations" value="Active" />
          <StatCard icon={<Zap size={18} className="text-yellow-400" />} label="Energy Monitor" value="18 circuits" />
          <StatCard icon={<Brain size={18} className="text-violet-400" />} label="AI Snapshots" value="Every 15m" />
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-3">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Observed patterns</p>
          <div className="space-y-2 text-sm text-neutral-300">
            <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Lights auto-dim at 10pm — sleep routine consistent</p>
            <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />Peak energy usage 7–9pm · 18-channel Refoss monitor active</p>
            <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />AI agent generates a daily home briefing every morning at 8am</p>
            <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Raspberry Pi HA hub: 99.9% uptime, zero cloud dependency</p>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
            <Lock size={13} className="text-neutral-500" />
            <p className="text-xs text-neutral-500">Device names, energy stats, and daily briefings — <a href="/login" className="text-blue-400 hover:text-blue-300">login to explore</a></p>
          </div>
        </div>
      </section>
    </div>
  )
}

function FunStat({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4">
      <p className="text-2xl mb-1">{emoji}</p>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-bold text-white mt-0.5">{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{sub}</p>
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

function PatternCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string
  color: 'emerald' | 'amber' | 'blue' | 'red'
}) {
  const colors = { emerald: 'text-emerald-400', amber: 'text-amber-400', blue: 'text-blue-400', red: 'text-red-400' }
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-neutral-400">{label}</p></div>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{sub}</p>
    </div>
  )
}
