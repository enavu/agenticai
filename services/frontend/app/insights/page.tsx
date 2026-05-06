'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Brain, RefreshCw, Calendar } from 'lucide-react'

interface HAInsight {
  id: string
  date: string
  summary: string
  created_at: string
}

function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<HAInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    fetch('/api/v1/home/insights', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setInsights(d.insights ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }

  async function generate() {
    setGenerating(true)
    try {
      await fetch('/api/v1/home/insights/generate', { method: 'POST', credentials: 'include' })
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-neutral-500 text-sm">Loading…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Life Patterns</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Daily home activity briefings — generated at 8am from your Home Assistant data
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Generating…' : 'Generate Now'}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {insights.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center space-y-3">
          <Brain size={32} className="text-neutral-600 mx-auto" />
          <p className="text-sm text-neutral-400">No insights yet.</p>
          <p className="text-xs text-neutral-600">
            The agent runs daily at 8am. Click "Generate Now" to create today's briefing from yesterday's data.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map(insight => (
            <div key={insight.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-violet-400" />
                <span className="text-sm font-medium text-neutral-300">{fmtDate(insight.date)}</span>
              </div>
              <div className="flex gap-3">
                <Brain size={16} className="text-violet-400 shrink-0 mt-0.5" />
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                  {insight.summary}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
