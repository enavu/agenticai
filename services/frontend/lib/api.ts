const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

export interface Workout {
  id: string
  class_date: string
  class_name: string
  instructor: string
  studio: string
  duration_minutes: number
  cals_burned?: number
  avg_output?: number
  total_output?: number
  rank?: string
  created_at: string
}

export interface WorkoutStats {
  total_workouts: number
  total_calories: number
  total_minutes: number
  avg_calories: number
  last_workout: string
  workouts_this_month: number
}

export interface Post {
  id: string
  caption: string
  image_url?: string
  instagram_id?: string
  status: 'draft' | 'published' | 'failed'
  workout_ids: string[]
  agent_run_id?: string
  published_at?: string
  created_at: string
}

export interface AgentStep {
  index: number
  type: 'thinking' | 'tool_call' | 'tool_result' | 'final'
  content: string
  tool_name?: string
  tool_input?: string
  tool_result?: string
  timestamp: string
}

export interface AgentRun {
  id: string
  agent_type: 'ha' | 'content'
  status: 'running' | 'completed' | 'failed'
  input: string
  output?: string
  steps: AgentStep[]
  error?: string
  started_at: string
  completed_at?: string
}

export interface HAState {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
  last_updated: string
}

// ─── API functions ────────────────────────────────────────────────────────────

export const api = {
  health: () => apiFetch<Record<string, string>>('/health'),

  workouts: {
    list: () => apiFetch<{ workouts: Workout[]; stats: WorkoutStats }>('/api/v1/workouts'),
    sync: () => apiFetch<{ synced: number; skipped: number; total: number }>(
      '/api/v1/workouts/sync', { method: 'POST' }
    ),
  },

  home: {
    state: () => apiFetch<{ states: HAState[]; count: number }>('/api/v1/home/state'),
    lights: () => apiFetch<{ lights: HAState[] }>('/api/v1/home/lights'),
  },

  posts: {
    list: () => apiFetch<{ posts: Post[] }>('/api/v1/posts'),
    generate: () => apiFetch<{ agent_run_id: string; status: string; output?: string }>(
      '/api/v1/posts/generate', { method: 'POST' }
    ),
  },

  agents: {
    runs: () => apiFetch<{ runs: AgentRun[] }>('/api/v1/agents/runs'),
    run: (id: string) => apiFetch<AgentRun>(`/api/v1/agents/runs/${id}`),
  },
}
