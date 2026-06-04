import { useEffect, useState, useRef } from 'react'
import { AlertTriangle, RefreshCw, Upload, Loader2, TrendingDown } from 'lucide-react'
import { CoachResponse } from '../components/CoachResponse.jsx'

function TransactionRow({ tx }) {
  const isDoorDash = tx.flagged
  return (
    <tr className={`border-b border-gray-800/50 ${isDoorDash ? 'bg-rose-950/10' : 'hover:bg-gray-800/30'} transition-colors`}>
      <td className="px-4 py-2.5 text-sm text-gray-400">
        {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </td>
      <td className="px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          {isDoorDash && <AlertTriangle size={13} className="text-rose-400 shrink-0" />}
          <span className={isDoorDash ? 'text-rose-300 font-medium' : 'text-gray-200'}>
            {tx.merchant}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500">{tx.category}</td>
      <td className="px-4 py-2.5 text-sm text-right font-mono">
        <span className={isDoorDash ? 'text-rose-400 font-semibold' : 'text-gray-300'}>
          ${parseFloat(tx.amount).toFixed(2)}
        </span>
      </td>
    </tr>
  )
}

export default function Spending() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [days, setDays] = useState(7)
  const fileRef = useRef()

  async function load() {
    setLoading(true)
    fetch(`/api/transactions?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [days])

  async function syncPlaid() {
    setSyncing(true)
    try {
      await fetch('/api/plaid/sync', { method: 'POST' })
      await load()
    } finally {
      setSyncing(false)
    }
  }

  async function uploadCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/transactions/import-doordash', { method: 'POST', body: form })
      const result = await res.json()
      setUploadResult(result)
      await load()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const summary = data?.summary
  const transactions = data?.transactions || []
  const ddTotal = parseFloat(summary?.doordash_total || 0)
  const ddCount = parseInt(summary?.doordash_count || 0)
  const totalSpend = parseFloat(summary?.total_spend || 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Spending</h1>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={syncPlaid}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            Sync
          </button>
        </div>
      </div>

      {/* DoorDash warning banner */}
      {ddCount > 0 && (
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-300">
              {ddCount} DoorDash order{ddCount !== 1 ? 's' : ''} — ${ddTotal.toFixed(2)} in {days} days
            </p>
            <p className="text-xs text-rose-400/70 mt-0.5">
              That's ${(ddTotal / Math.max(1, ddCount)).toFixed(2)} per order. Paris is watching.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Total spend" value={`$${totalSpend.toFixed(0)}`} />
          <SummaryCard
            label="DoorDash"
            value={`$${ddTotal.toFixed(0)}`}
            sub={`${ddCount} orders`}
            danger={ddCount > 0}
          />
          <SummaryCard
            label="DoorDash %"
            value={totalSpend > 0 ? `${Math.round((ddTotal / totalSpend) * 100)}%` : '—'}
            sub="of total spend"
            danger={totalSpend > 0 && ddTotal / totalSpend > 0.15}
          />
        </div>
      )}

      {/* CSV import */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-300">Import DoorDash order history</p>
          <p className="text-xs text-gray-500 mt-0.5">Upload CSV export from DoorDash — auto-flagged and added to food log</p>
        </div>
        <div className="flex items-center gap-2">
          {uploadResult && (
            <span className="text-xs text-emerald-400">{uploadResult.imported} imported</span>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Upload CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={uploadCSV} className="hidden" />
        </div>
      </div>

      {/* Coach section */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">How am I doing?</h2>
        <CoachResponse promptType="spending" label="Roast my spending" />
      </div>

      {/* Transaction table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No transactions yet. <button onClick={syncPlaid} className="text-brand-400 hover:underline">Sync from Plaid →</button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-800/50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Merchant</th>
                <th className="px-4 py-2.5 text-left">Category</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-gray-950">
              {transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, danger }) {
  return (
    <div className={`rounded-xl border p-4 ${danger ? 'border-rose-800/50 bg-rose-950/20' : 'border-gray-800 bg-gray-900'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${danger ? 'text-rose-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}
