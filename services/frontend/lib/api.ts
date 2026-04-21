const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    credentials: 'include',
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

export interface LeaseAgreement {
  id: string
  name: string
  person_name: string
  total_amount: number
  start_date: string
  end_date: string
  expected_monthly: number
  payment_day: number
  notes: string
  created_at: string
}

export type PaymentStatus = 'on_time' | 'late' | 'partial' | 'missed'

export interface LeasePayment {
  id: string
  agreement_id: string
  amount_expected: number
  amount_paid: number
  due_date: string
  paid_date: string | null
  status: PaymentStatus
  notes: string
  created_at: string
}

export interface LeaseStats {
  total_paid: number
  remaining: number
  progress_pct: number
  reliability_score: number
  count_on_time: number
  count_late: number
  count_partial: number
  count_missed: number
}

export interface LeaseData {
  agreement: LeaseAgreement | null
  payments: LeasePayment[]
  stats: LeaseStats | null
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
    generate: (imageURL?: string) => apiFetch<{ agent_run_id: string; status: string; output?: string }>(
      '/api/v1/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ image_url: imageURL ?? '' }),
      }
    ),
  },

  uploads: {
    upload: async (file: File): Promise<{ url: string }> => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/api/v1/uploads`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Upload ${res.status}: ${text}`)
      }
      return res.json()
    },
  },

  agents: {
    runs: () => apiFetch<{ runs: AgentRun[] }>('/api/v1/agents/runs'),
    run: (id: string) => apiFetch<AgentRun>(`/api/v1/agents/runs/${id}`),
  },

  finance: {
    get: () => apiFetch<LeaseData>('/api/v1/finance'),
    setup: (body: {
      name: string
      person_name: string
      total_amount: number
      start_date: string
      end_date: string
      expected_monthly: number
      payment_day: number
      notes: string
    }) => apiFetch<LeaseAgreement>('/api/v1/finance/setup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    logPayment: (body: {
      amount_expected: number
      amount_paid: number
      due_date: string
      paid_date: string
      notes: string
    }) => apiFetch<LeasePayment>('/api/v1/finance/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    updatePayment: (id: string, body: {
      amount_expected: number
      amount_paid: number
      due_date: string
      paid_date: string
      notes: string
    }) => apiFetch<{ id: string; status: PaymentStatus }>(`/api/v1/finance/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  },
}
