import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { useMood, MoodBadge } from './MoodToggle.jsx'

export function CoachResponse({ promptType, label = 'Ask your coach', extraContext = '' }) {
  const { mood } = useMood()
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [usedMood, setUsedMood] = useState(null)

  async function ask() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/claude/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, prompt_type: promptType, extra_context: extraContext }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setResponse(data.response)
      setUsedMood(data.mood)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const moodStyles = {
    coach:    'border-emerald-700/50 bg-emerald-950/30',
    funny:    'border-amber-700/50 bg-amber-950/30',
    scorched: 'border-rose-700/50 bg-rose-950/30',
  }

  return (
    <div className="space-y-3">
      <button
        onClick={ask}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? <Loader2 size={15} className="animate-spin" />
          : <Sparkles size={15} />}
        {loading ? 'Thinking…' : label}
      </button>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {response && (
        <div className={`rounded-xl border p-5 space-y-3 ${moodStyles[usedMood] || moodStyles.coach}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Sparkles size={12} />
              <span>Claude's take</span>
            </div>
            <div className="flex items-center gap-2">
              <MoodBadge />
              <button
                onClick={ask}
                disabled={loading}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Regenerate"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </div>
  )
}
