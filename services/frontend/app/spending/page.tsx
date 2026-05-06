'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { api, SpendingInsight } from '@/lib/api'
import { Link, RefreshCw, Brain, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(n: number, total: number) {
  if (!total) return '0%'
  return ((n / total) * 100).toFixed(1) + '%'
}

const CAT_COLORS: Record<string, string> = {
  'Food and Drink': 'bg-orange-500',
  'Travel': 'bg-blue-500',
  'Shopping': 'bg-pink-500',
  'Entertainment': 'bg-purple-500',
  'Health and Fitness': 'bg-emerald-500',
  'Transfer': 'bg-neutral-500',
  'Payment': 'bg-neutral-600',
  'Shops': 'bg-pink-400',
  'Recreation': 'bg-teal-500',
  'Service': 'bg-cyan-500',
  'Other': 'bg-neutral-700',
}

function catColor(cat: string) {
  return CAT_COLORS[cat] ?? 'bg-neutral-600'
}

function PlaidConnectButton({ onSuccess }: { onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.plaid.linkToken().then(r => setLinkToken(r.link_token)).catch(console.error)
  }, [])

  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    setLoading(true)
    try {
      await api.plaid.exchange(publicToken)
      await api.plaid.sync()
      onSuccess()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: onPlaidSuccess,
  })

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors disabled:opacity-50"
    >
      <Link size={15} />
      {loading ? 'Connecting…' : 'Connect Capital One'}
    </button>
  )
}

export default function SpendingPage() {
  const [data, setData] = useState<SpendingInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    api.plaid.spending()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }

  async function sync() {
    setSyncing(true)
    try {
      await api.plaid.sync()
      load()
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-neutral-500 text-sm">Loading…</div>
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Spending</h1>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  // Not connected yet
  if (!data?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Spending</h1>
          <p className="mt-1 text-sm text-neutral-400">AI-powered spending analysis — connect your bank to get started</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center space-y-4 max-w-md mx-auto">
          <div className="flex justify-center">
            <div className="rounded-full border border-neutral-700 bg-neutral-800 p-4">
              <DollarSign size={24} className="text-neutral-400" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Connect your bank</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Connect Capital One via Plaid to pull 90 days of transactions.
              Claude will analyze your spending and tell you exactly where to cut back.
            </p>
          </div>
          <PlaidConnectButton onSuccess={load} />
        </div>
      </div>
    )
  }

  const top5 = data.categories.slice(0, 5)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Spending</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Last {data.period_days} days · {data.transactions?.length ?? 0} transactions
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {/* Total spent */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={18} className="text-neutral-400" />
            <p className="text-xs text-neutral-400">Total spent</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(data.total_spent)}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-neutral-400" />
            <p className="text-xs text-neutral-400">Avg / month</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(data.total_spent / 3)}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} className="text-neutral-400" />
            <p className="text-xs text-neutral-400">Top category</p>
          </div>
          <p className="text-lg font-bold text-white truncate">{data.categories[0]?.category ?? '—'}</p>
        </div>
      </div>

      {/* Category breakdown */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">By Category</h2>
        <div className="space-y-3">
          {top5.map(cat => (
            <div key={cat.category}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-neutral-300">{cat.category}</span>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>{cat.count} transactions</span>
                  <span className="text-white font-medium">{fmt(cat.total)}</span>
                  <span className="w-10 text-right">{pct(cat.total, data.total_spent)}</span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-800">
                <div
                  className={`h-2 rounded-full ${catColor(cat.category)} transition-all`}
                  style={{ width: pct(cat.total, data.total_spent) }}
                />
              </div>
            </div>
          ))}
          {data.categories.length > 5 && (
            <p className="text-xs text-neutral-600">
              +{data.categories.length - 5} more categories — {fmt(data.categories.slice(5).reduce((s, c) => s + c.total, 0))} combined
            </p>
          )}
        </div>
      </section>

      {/* AI Insights */}
      {data.ai_insights && (
        <section className="rounded-lg border border-violet-800/30 bg-violet-900/10 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-violet-400" />
            <h2 className="text-sm font-medium text-violet-300">Claude's Take</h2>
          </div>
          <div className="text-sm text-neutral-300 whitespace-pre-line leading-relaxed">
            {data.ai_insights}
          </div>
        </section>
      )}

      {/* Recent transactions */}
      {data.transactions && data.transactions.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">Recent Transactions</h2>
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-neutral-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left hidden sm:table-cell">Category</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {data.transactions.slice(0, 50).map(t => (
                  <tr key={t.id} className="bg-neutral-950 hover:bg-neutral-900 transition-colors">
                    <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-2.5 text-neutral-300">
                      {t.merchant_name || t.name}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500 text-xs hidden sm:table-cell">
                      {t.category?.[0] ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-white">
                      {t.amount > 0 ? fmt(t.amount) : <span className="text-emerald-400">{fmt(Math.abs(t.amount))}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
