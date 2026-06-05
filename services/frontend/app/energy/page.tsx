'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Zap, TrendingUp, DollarSign, Calendar, AlertCircle, Activity } from 'lucide-react'

interface EnergyChannel {
  id: number
  name: string
  is_mains: boolean
  power_w: number
  current_a: number
  voltage_v: number
  power_factor: number
  today_kwh: number
  week_kwh: number
  month_kwh: number
  last_updated: string
}

interface EnergySummary {
  total_power_w: number
  today_kwh: number
  week_kwh: number
  month_kwh: number
  daily_avg_kwh: number
  projected_month_kwh: number
  projected_cost_usd: number
  day_of_month: number
  online_since?: string
  days_of_data: number
  fetched_at: string
}

interface EnergyData {
  channels: EnergyChannel[]
  summary: EnergySummary
}

function fmt(n: number, dec = 1) {
  return n.toFixed(dec)
}

function fmtKwh(n: number) {
  return n < 1 ? `${(n * 1000).toFixed(0)} Wh` : `${n.toFixed(1)} kWh`
}

function barColor(w: number, max: number) {
  const pct = w / max
  if (pct > 0.6) return '#f87171'
  if (pct > 0.3) return '#fb923c'
  return '#34d399'
}

function getFunInsight(channels: EnergyChannel[], summary: EnergySummary): string {
  const ch = (id: number) => channels.find(c => c.id === id)
  const furnace1 = ch(2)
  const furnace2 = ch(8)
  const dishwasher = ch(15)
  const nonMainsW = channels.filter(c => !c.is_mains).reduce((s, c) => s + c.power_w, 0)
  const hvacW = (furnace1?.power_w ?? 0) + (furnace2?.power_w ?? 0)
  const lightingIds = [6, 11, 13, 14, 16]
  const lightingW = lightingIds.reduce((s, id) => s + (ch(id)?.power_w ?? 0), 0)

  if (furnace1 && furnace2 && furnace1.power_w > 500 && furnace2.power_w > 500)
    return `Both furnaces are running simultaneously — a ${Math.round(hvacW)}W double-team. Your heating bill is having a main character moment. ⚔️`

  if (nonMainsW > 0 && hvacW / nonMainsW > 0.5)
    return `HVAC is eating ${Math.round((hvacW / nonMainsW) * 100)}% of your home's draw right now. Colorado winters are not playing around. 🥶`

  if (dishwasher && dishwasher.power_w < 5 && summary.today_kwh > 1)
    return `The dishwasher is clocked out (0W) while the rest of the house is pulling ${Math.round(summary.total_power_w)}W. Freeloading confirmed. 🍽️`

  if (nonMainsW > 0 && lightingW / nonMainsW > 0.25)
    return `${Math.round((lightingW / nonMainsW) * 100)}% of current draw is just lights. Someone's got a thing for ambiance. 💡`

  const dailyCost = summary.daily_avg_kwh * 0.12
  if (dailyCost > 4)
    return `At $${dailyCost.toFixed(2)}/day you're on pace for a $${Math.round(dailyCost * 30)} month. Just vibes and kilowatts. 💸`

  if (summary.total_power_w < 300)
    return `${Math.round(summary.total_power_w)}W whole-home draw. Extremely chill. The house is basically meditating. 🧘`

  return `Running ${Math.round(summary.total_power_w)}W across ${channels.filter(c => !c.is_mains && c.power_w > 5).length} active circuits. Normal chaos. ⚡`
}

export default function EnergyPage() {
  const [data, setData] = useState<EnergyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/v1/home/energy', { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-neutral-400">
      <Activity size={20} className="animate-pulse mr-2" /> Loading energy data…
    </div>
  )

  if (error || !data) return (
    <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-6 text-red-400 flex items-center gap-3">
      <AlertCircle size={18} /> {error || 'No data'}
    </div>
  )

  const { channels, summary } = data

  const circuits = channels
    .filter(c => !c.is_mains)
    .sort((a, b) => b.power_w - a.power_w)

  const maxPower = Math.max(...circuits.map(c => c.power_w), 100)
  const top5 = circuits.slice(0, 5)
  const hvac = channels.filter(c => c.id === 2 || c.id === 8)
  const onlineSince = summary.online_since ? new Date(summary.online_since) : null
  const partialMonth = summary.days_of_data < summary.day_of_month
  const funInsight = getFunInsight(channels, summary)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap size={22} className="text-yellow-400" /> Energy Monitor
          </h1>
          {onlineSince && (
            <p className="text-xs text-neutral-500 mt-0.5">
              Refoss online since {onlineSince.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' '}· {summary.days_of_data} days of data
            </p>
          )}
        </div>
        <span className="text-xs text-neutral-600">
          Updated {new Date(summary.fetched_at).toLocaleTimeString()}
        </span>
      </div>

      {/* Partial-month warning */}
      {partialMonth && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-400">
          <AlertCircle size={13} />
          Month totals reflect {summary.days_of_data} of {summary.day_of_month} days — projections extrapolated from that window
        </div>
      )}

      {/* Fun insight */}
      <div className="rounded-lg border border-violet-800/40 bg-violet-950/20 px-4 py-3 text-sm text-violet-300 italic">
        {funInsight}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-yellow-800/40 bg-yellow-950/20 p-4">
          <div className="flex items-center gap-1.5 text-xs text-yellow-400 mb-1"><Zap size={12} /> Live</div>
          <p className="text-2xl font-bold text-white">{fmt(summary.total_power_w, 0)} W</p>
          <p className="text-xs text-neutral-500 mt-0.5">whole home</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1"><Calendar size={12} /> Today</div>
          <p className="text-2xl font-bold text-white">{fmtKwh(summary.today_kwh)}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1"><TrendingUp size={12} /> This week</div>
          <p className="text-2xl font-bold text-white">{fmtKwh(summary.week_kwh)}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
            <Calendar size={12} /> This month
          </div>
          <p className="text-2xl font-bold text-white">{fmtKwh(summary.month_kwh)}</p>
          <p className="text-xs text-neutral-600 mt-0.5">{summary.days_of_data}d data</p>
        </div>
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-1"><DollarSign size={12} /> Est. bill</div>
          <p className="text-2xl font-bold text-white">${fmt(summary.projected_cost_usd, 0)}</p>
          <p className="text-xs text-neutral-600 mt-0.5">{fmt(summary.projected_month_kwh)} kWh proj.</p>
        </div>
      </div>

      {/* Top 5 consumers */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Zap size={14} className="text-orange-400" /> Top consumers right now
        </h2>
        <div className="space-y-2">
          {top5.map((ch, i) => (
            <div key={ch.id} className="flex items-center gap-3">
              <span className="text-xs text-neutral-600 w-4">{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-300">{ch.name}</span>
                  <span className="text-neutral-400 font-mono">{fmt(ch.power_w, 0)} W</span>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (ch.power_w / maxPower) * 100)}%`,
                      backgroundColor: barColor(ch.power_w, maxPower),
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HVAC */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">HVAC — Furnaces</h2>
        <div className="grid grid-cols-2 gap-4">
          {hvac.map(ch => (
            <div key={ch.id} className="bg-neutral-800/50 rounded-lg p-4">
              <p className="text-xs text-neutral-400 mb-1">{ch.name}</p>
              <p className="text-xl font-bold text-white">{fmt(ch.power_w, 0)} W</p>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div>
                  <p className="text-xs text-neutral-600">Today</p>
                  <p className="text-xs font-medium text-neutral-300">{fmtKwh(ch.today_kwh)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-600">Week</p>
                  <p className="text-xs font-medium text-neutral-300">{fmtKwh(ch.week_kwh)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-600">Month</p>
                  <p className="text-xs font-medium text-neutral-300">{fmtKwh(ch.month_kwh)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All circuits bar chart */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">All circuits — live watts</h2>
        <ResponsiveContainer width="100%" height={circuits.length * 32}>
          <BarChart
            data={circuits.map(c => ({ name: c.name, w: Math.round(c.power_w) }))}
            layout="vertical"
            margin={{ left: 0, right: 40, top: 0, bottom: 0 }}
          >
            <XAxis type="number" domain={[0, maxPower]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={200}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
            />
            <Tooltip
              formatter={(v: number) => [`${v} W`, 'Power']}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: 12 }}
            />
            <Bar dataKey="w" radius={[0, 3, 3, 0]} maxBarSize={16}>
              {circuits.map((_, i) => (
                <Cell key={i} fill={barColor(circuits[i].power_w, maxPower)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full circuit table */}
      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <div className="bg-neutral-800/50 px-4 py-2 text-xs text-neutral-500 uppercase tracking-wide">
          All circuits
        </div>
        <table className="w-full">
          <thead className="text-xs text-neutral-600 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-2 text-left">Circuit</th>
              <th className="px-4 py-2 text-right">W</th>
              <th className="px-4 py-2 text-right">A</th>
              <th className="px-4 py-2 text-right">Today</th>
              <th className="px-4 py-2 text-right">Month</th>
            </tr>
          </thead>
          <tbody>
            {channels.map(ch => (
              <tr key={ch.id} className={`border-b border-neutral-800/50 ${ch.is_mains ? 'bg-yellow-950/10' : 'hover:bg-neutral-800/30'}`}>
                <td className="px-4 py-2 text-sm">
                  {ch.is_mains && <span className="mr-1.5 text-yellow-500">⚡</span>}
                  <span className={ch.is_mains ? 'text-yellow-300 font-medium' : 'text-neutral-300'}>
                    CH{ch.id} · {ch.name}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-right font-mono text-neutral-200">{fmt(ch.power_w, 0)}</td>
                <td className="px-4 py-2 text-sm text-right font-mono text-neutral-500">{fmt(ch.current_a, 2)}</td>
                <td className="px-4 py-2 text-sm text-right text-neutral-400">{fmtKwh(ch.today_kwh)}</td>
                <td className="px-4 py-2 text-sm text-right text-neutral-400">{fmtKwh(ch.month_kwh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
