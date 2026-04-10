'use client'

import { useState, useEffect } from 'react'
import { api, type AgentRun, type AgentStep } from '@/lib/api'
import { Bot, ChevronRight, Wrench, Brain, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { clsx } from 'clsx'

const statusIcons = {
  completed: <CheckCircle2 size={14} className="text-emerald-400" />,
  failed: <AlertCircle size={14} className="text-red-400" />,
  running: <Clock size={14} className="text-yellow-400 animate-spin" />,
}

const stepTypeConfig = {
  thinking: { icon: <Brain size={14} className="text-purple-400" />, label: 'Thinking', color: 'border-purple-800/40 bg-purple-900/10' },
  tool_call: { icon: <Wrench size={14} className="text-blue-400" />, label: 'Tool Call', color: 'border-blue-800/40 bg-blue-900/10' },
  tool_result: { icon: <ChevronRight size={14} className="text-emerald-400" />, label: 'Result', color: 'border-emerald-800/40 bg-emerald-900/10' },
  final: { icon: <CheckCircle2 size={14} className="text-white" />, label: 'Final', color: 'border-neutral-700 bg-neutral-900' },
}

export default function AgentsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [selected, setSelected] = useState<AgentRun | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.agents.runs()
      .then(res => setRuns(res.runs ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function selectRun(run: AgentRun) {
    const full = await api.agents.run(run.id)
    setSelected(full)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Agent Runs</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Full ReAct trace — every tool call and reasoning step
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Run list */}
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 text-center text-neutral-500 text-sm">Loading…</div>
          ) : runs.length === 0 ? (
            <div className="py-8 text-center text-neutral-500 text-sm">
              No agent runs yet. Send a chat message or generate a post.
            </div>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => selectRun(run)}
                className={clsx(
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  selected?.id === run.id
                    ? 'border-blue-700 bg-blue-900/20'
                    : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Bot size={13} className="text-neutral-400" />
                    <span className="text-xs font-medium text-neutral-300 uppercase">
                      {run.agent_type}
                    </span>
                  </div>
                  {statusIcons[run.status]}
                </div>
                <p className="text-sm text-white line-clamp-2">{run.input}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {new Date(run.started_at).toLocaleString()} · {run.steps?.length ?? 0} steps
                </p>
              </button>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selected ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden">
              <div className="border-b border-neutral-800 bg-neutral-900 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  {statusIcons[selected.status]}
                  <span className="text-sm font-medium text-white capitalize">{selected.agent_type} Agent</span>
                </div>
                <p className="text-sm text-neutral-300">{selected.input}</p>
              </div>

              <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
                {(selected.steps ?? []).map((step: AgentStep) => {
                  const cfg = stepTypeConfig[step.type] ?? stepTypeConfig.thinking
                  return (
                    <div key={step.index} className={clsx('rounded-lg border p-3', cfg.color)}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {cfg.icon}
                        <span className="text-xs font-medium text-neutral-300">{cfg.label}</span>
                        {step.tool_name && (
                          <code className="ml-auto text-xs bg-neutral-800 text-blue-300 px-1.5 py-0.5 rounded">
                            {step.tool_name}
                          </code>
                        )}
                      </div>
                      <p className="text-sm text-neutral-300 whitespace-pre-wrap">{step.content}</p>
                      {step.tool_input && (
                        <pre className="mt-2 text-xs bg-neutral-900 rounded p-2 overflow-x-auto text-neutral-400">
                          {step.tool_input}
                        </pre>
                      )}
                      {step.tool_result && (
                        <pre className="mt-1 text-xs bg-neutral-900 rounded p-2 overflow-x-auto text-emerald-300 max-h-32 overflow-y-auto">
                          {step.tool_result}
                        </pre>
                      )}
                    </div>
                  )
                })}

                {selected.output && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-xs font-medium text-neutral-400 mb-1">Final Output</p>
                    <p className="text-sm text-white">{selected.output}</p>
                  </div>
                )}
                {selected.error && (
                  <div className="rounded-lg border border-red-800 bg-red-900/20 p-3">
                    <p className="text-xs font-medium text-red-400 mb-1">Error</p>
                    <p className="text-sm text-red-300">{selected.error}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 py-16 text-center text-neutral-500 text-sm">
              Select an agent run to view the full ReAct trace
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
