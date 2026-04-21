'use client'

import { useEffect, useState } from 'react'
import { api, LeaseData, LeasePayment, PaymentStatus } from '@/lib/api'
import { DollarSign, TrendingDown, CheckCircle, Clock, AlertTriangle, XCircle, Plus, Shield, Pencil } from 'lucide-react'

const STATUS_META: Record<PaymentStatus, { label: string; color: string; icon: React.ReactNode; score: number }> = {
  on_time:  { label: 'On Time',  color: 'text-emerald-400', icon: <CheckCircle   size={14} />, score: 100 },
  late:     { label: 'Late',     color: 'text-yellow-400',  icon: <Clock         size={14} />, score: 70  },
  partial:  { label: 'Partial',  color: 'text-orange-400',  icon: <AlertTriangle size={14} />, score: 50  },
  missed:   { label: 'Missed',   color: 'text-red-400',     icon: <XCircle       size={14} />, score: 0   },
}

function scoreColor(score: number) {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Mirrors the backend computeStatus logic so the UI can show a live preview.
function computeStatus(amountExpected: number, amountPaid: number, dueDate: string, paidDate: string): PaymentStatus {
  if (!paidDate || amountPaid === 0) return 'missed'
  if (amountPaid < amountExpected) return 'partial'
  return new Date(paidDate) <= new Date(dueDate) ? 'on_time' : 'late'
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ─── Setup form ──────────────────────────────────────────────────────────────

function SetupForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    name: '', person_name: '', total_amount: '',
    start_date: '', end_date: '', expected_monthly: '', payment_day: '15', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.finance.setup({
        name: form.name,
        person_name: form.person_name,
        total_amount: parseFloat(form.total_amount),
        start_date: form.start_date,
        end_date: form.end_date,
        expected_monthly: parseFloat(form.expected_monthly || '0'),
        payment_day: parseInt(form.payment_day || '15'),
        notes: form.notes,
      })
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 max-w-lg mx-auto">
      <h2 className="text-lg font-semibold text-white mb-4">Set up lease agreement</h2>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Agreement label" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Smith lease 2024" required />
        <Field label="Person name" value={form.person_name} onChange={v => setForm(f => ({ ...f, person_name: v }))} placeholder="Full name" required />
        <Field label="Total amount owed ($)" type="number" value={form.total_amount} onChange={v => setForm(f => ({ ...f, total_amount: v }))} placeholder="15000" required />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date" type="date" value={form.start_date} onChange={v => setForm(f => ({ ...f, start_date: v }))} required />
          <Field label="End date" type="date" value={form.end_date} onChange={v => setForm(f => ({ ...f, end_date: v }))} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Expected monthly ($)" type="number" value={form.expected_monthly} onChange={v => setForm(f => ({ ...f, expected_monthly: v }))} placeholder="optional" />
          <Field label="Payment due day" type="number" value={form.payment_day} onChange={v => setForm(f => ({ ...f, payment_day: v }))} placeholder="15" />
        </div>
        <Field label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="optional" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {loading ? 'Saving…' : 'Save agreement'}
        </button>
      </form>
    </div>
  )
}

// ─── Payment modal (log + edit) ───────────────────────────────────────────────

type PaymentFormState = {
  amount_expected: string
  amount_paid: string
  due_date: string
  paid_date: string
  notes: string
}

function PaymentModal({ expectedMonthly, paymentDay, existing, onDone, onClose }: {
  expectedMonthly: number
  paymentDay: number
  existing?: LeasePayment
  onDone: () => void
  onClose: () => void
}) {
  const today = new Date().toISOString().split('T')[0]

  // Default due_date to the configured payment day of the current month.
  const now = new Date()
  const defaultDue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(paymentDay).padStart(2, '0')}`

  const [form, setForm] = useState<PaymentFormState>(existing ? {
    amount_expected: existing.amount_expected.toString(),
    amount_paid: existing.amount_paid.toString(),
    due_date: existing.due_date.split('T')[0],
    paid_date: existing.paid_date ? existing.paid_date.split('T')[0] : '',
    notes: existing.notes,
  } : {
    amount_expected: expectedMonthly ? expectedMonthly.toString() : '',
    amount_paid: '',
    due_date: defaultDue,
    paid_date: today,
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const previewStatus = computeStatus(
    parseFloat(form.amount_expected) || 0,
    parseFloat(form.amount_paid) || 0,
    form.due_date,
    form.paid_date,
  )
  const previewMeta = STATUS_META[previewStatus]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const body = {
      amount_expected: parseFloat(form.amount_expected),
      amount_paid: parseFloat(form.amount_paid) || 0,
      due_date: form.due_date,
      paid_date: form.paid_date,
      notes: form.notes,
    }
    try {
      if (existing) {
        await api.finance.updatePayment(existing.id, body)
      } else {
        await api.finance.logPayment(body)
      }
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{existing ? 'Edit payment' : 'Log payment'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-sm">Cancel</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Expected ($)" type="number" value={form.amount_expected} onChange={v => setForm(f => ({ ...f, amount_expected: v }))} required />
            <Field label="Received ($)" type="number" value={form.amount_paid} onChange={v => setForm(f => ({ ...f, amount_paid: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Due date" type="date" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} required />
            <Field label="Date received" type="date" value={form.paid_date} onChange={v => setForm(f => ({ ...f, paid_date: v }))} />
          </div>

          {/* Live status preview */}
          <div className={`flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm ${previewMeta.color}`}>
            {previewMeta.icon}
            <span>Will be logged as <strong>{previewMeta.label}</strong></span>
          </div>

          <Field label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="optional" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            {loading ? 'Saving…' : existing ? 'Save changes' : 'Log payment'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600"
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [data, setData] = useState<LeaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; payment?: LeasePayment }>({ open: false })

  async function load() {
    try {
      const d = await api.finance.get()
      setData(d)
    } catch {
      setData({ agreement: null, payments: [], stats: null })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-neutral-500 text-sm">Loading…</div>
  }

  if (!data?.agreement) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Finance</h1>
          <p className="mt-1 text-sm text-neutral-400">Track money owed to you</p>
        </div>
        <SetupForm onDone={load} />
      </div>
    )
  }

  const { agreement, payments, stats } = data
  const score = stats?.reliability_score ?? 0
  const startMs = new Date(agreement.start_date).getTime()
  const endMs   = new Date(agreement.end_date).getTime()
  const nowMs   = Date.now()
  const termMonths = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24 * 30))
  const elapsedMonths = Math.max(0, Math.round((nowMs - startMs) / (1000 * 60 * 60 * 24 * 30)))
  const paymentsLogged = payments.length
  const paymentsLeft = Math.max(0, termMonths - paymentsLogged)

  return (
    <div className="space-y-8">
      {modal.open && (
        <PaymentModal
          expectedMonthly={agreement.expected_monthly}
          paymentDay={agreement.payment_day ?? 15}
          existing={modal.payment}
          onDone={() => { setModal({ open: false }); load() }}
          onClose={() => setModal({ open: false })}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Finance</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {agreement.name} · {agreement.person_name} · due {ordinal(agreement.payment_day ?? 15)} of each month
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700 transition-colors"
        >
          <Plus size={15} /> Log payment
        </button>
      </div>

      {/* Key numbers */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<DollarSign size={18} className="text-neutral-400" />} label="Total owed" value={fmt(agreement.total_amount)} />
        <StatCard icon={<CheckCircle size={18} className="text-emerald-400" />} label="Paid to date" value={fmt(stats?.total_paid ?? 0)} />
        <StatCard icon={<TrendingDown size={18} className="text-blue-400" />} label="Remaining" value={fmt(stats?.remaining ?? agreement.total_amount)} />
        <StatCard
          icon={<Shield size={18} className={scoreColor(score)} />}
          label="Reliability"
          value={`${score}/100`}
          valueClass={scoreColor(score)}
        />
      </section>

      {/* Progress bar */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Repayment progress</span>
          <span className="text-white font-medium">{(stats?.progress_pct ?? 0).toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-neutral-800">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(stats?.progress_pct ?? 0, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-neutral-500">
          <span>{fmtDate(agreement.start_date)}</span>
          <span>{elapsedMonths} of {termMonths} months elapsed</span>
          <span>{fmtDate(agreement.end_date)}</span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-neutral-800">
          <span className="text-xs text-neutral-500">{paymentsLogged} of {termMonths} payments logged</span>
          <span className={`text-xs font-medium ${paymentsLeft === 0 ? 'text-emerald-400' : 'text-neutral-300'}`}>
            {paymentsLeft === 0 ? 'All payments accounted for' : `${paymentsLeft} payment${paymentsLeft === 1 ? '' : 's'} remaining`}
          </span>
        </div>
      </section>

      {/* Reliability breakdown */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Payment reliability</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(STATUS_META) as PaymentStatus[]).map(s => {
            const meta = STATUS_META[s]
            const count = s === 'on_time' ? (stats?.count_on_time ?? 0)
                        : s === 'late'    ? (stats?.count_late ?? 0)
                        : s === 'partial' ? (stats?.count_partial ?? 0)
                        :                   (stats?.count_missed ?? 0)
            return (
              <div key={s} className="rounded-md border border-neutral-800 bg-neutral-950 px-4 py-3 text-center">
                <div className={`flex items-center justify-center gap-1.5 ${meta.color} mb-1`}>
                  {meta.icon}
                  <span className="text-xs">{meta.label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-xs text-neutral-500 mt-0.5">scores {meta.score}</p>
              </div>
            )
          })}
        </div>
        {payments.length === 0 && (
          <p className="text-sm text-neutral-500 mt-4 text-center">No payments logged yet.</p>
        )}
      </section>

      {/* Payment history */}
      {payments.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-neutral-400 uppercase tracking-wide">Payment history</h2>
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Due</th>
                  <th className="px-4 py-2 text-left">Received</th>
                  <th className="px-4 py-2 text-right">Expected</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-left">Notes</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {payments.map(p => {
                  const meta = STATUS_META[p.status]
                  return (
                    <tr key={p.id} className="bg-neutral-950 hover:bg-neutral-900 transition-colors">
                      <td className="px-4 py-2.5 text-neutral-400">{fmtDate(p.due_date)}</td>
                      <td className="px-4 py-2.5 text-neutral-400">
                        {p.paid_date ? fmtDate(p.paid_date) : <span className="text-red-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-400">{fmt(p.amount_expected)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-white">{fmt(p.amount_paid)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`flex items-center justify-center gap-1 ${meta.color}`}>
                          {meta.icon}
                          <span className="text-xs">{meta.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-neutral-500 text-xs">{p.notes || '—'}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setModal({ open: true, payment: p })}
                          className="text-neutral-500 hover:text-white transition-colors"
                          title="Edit payment"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, valueClass = 'text-white' }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4">
      <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-neutral-400">{label}</p></div>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}
