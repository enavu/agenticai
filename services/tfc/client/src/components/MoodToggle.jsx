import { useState, useEffect, createContext, useContext } from 'react'

// ─── Mood Context ─────────────────────────────────────────────────────────────

const MoodContext = createContext(null)

export function MoodProvider({ children }) {
  const [mood, setMoodState] = useState(() => {
    return localStorage.getItem('tfc_mood') || 'funny'
  })

  function setMood(newMood) {
    localStorage.setItem('tfc_mood', newMood)
    setMoodState(newMood)
  }

  return (
    <MoodContext.Provider value={{ mood, setMood }}>
      {children}
    </MoodContext.Provider>
  )
}

export function useMood() {
  const ctx = useContext(MoodContext)
  if (!ctx) throw new Error('useMood must be used inside MoodProvider')
  return ctx
}

// ─── Mood configs ─────────────────────────────────────────────────────────────

const MOODS = [
  {
    key: 'coach',
    label: 'Coach me',
    emoji: '🎯',
    desc: 'Structured, warm, CFP-friend energy',
    pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30',
    active: 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/30',
    ring: 'ring-emerald-500',
  },
  {
    key: 'funny',
    label: 'Make it funny',
    emoji: '🤡',
    desc: 'Chaotic bestie, absurdist, good vibes',
    pill: 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30',
    active: 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/30',
    ring: 'ring-amber-500',
  },
  {
    key: 'scorched',
    label: 'Scorch me',
    emoji: '🔥',
    desc: 'No mercy. Specific. Brutal. True.',
    pill: 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30',
    active: 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-500/30',
    ring: 'ring-rose-500',
  },
]

// ─── Toggle component (header version — compact pills) ────────────────────────

export function MoodToggle() {
  const { mood, setMood } = useMood()
  const [showLabel, setShowLabel] = useState(false)

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 mr-1 hidden sm:block">what's my mood?</span>
      {MOODS.map(m => (
        <button
          key={m.key}
          onClick={() => setMood(m.key)}
          title={m.desc}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium
            transition-all duration-200 cursor-pointer select-none
            ${mood === m.key ? m.active : m.pill}
          `}
        >
          <span>{m.emoji}</span>
          <span className="hidden sm:inline">{m.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Full mood selector (inline, card style) ──────────────────────────────────

export function MoodSelector() {
  const { mood, setMood } = useMood()

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {MOODS.map(m => (
        <button
          key={m.key}
          onClick={() => setMood(m.key)}
          className={`
            flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-left
            transition-all duration-200 cursor-pointer
            ${mood === m.key ? m.active + ' ring-2 ' + m.ring : m.pill}
          `}
        >
          <span className="text-2xl">{m.emoji}</span>
          <div>
            <p className="font-semibold text-sm">{m.label}</p>
            <p className={`text-xs opacity-75 ${mood === m.key ? 'text-white' : ''}`}>{m.desc}</p>
          </div>
          {mood === m.key && (
            <span className="ml-auto text-xs opacity-75">active</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Mood badge (read-only indicator) ─────────────────────────────────────────

export function MoodBadge() {
  const { mood } = useMood()
  const m = MOODS.find(x => x.key === mood)
  if (!m) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${m.pill}`}>
      {m.emoji} {m.label}
    </span>
  )
}
