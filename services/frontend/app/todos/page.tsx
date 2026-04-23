import { Lightbulb, GitBranch, Wind, ShieldCheck, RefreshCw } from 'lucide-react'

const IDEAS = [
  {
    id: 1,
    icon: GitBranch,
    color: 'text-violet-400',
    border: 'border-violet-800/50',
    bg: 'bg-violet-900/10',
    badge: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
    title: 'Nondeterministic Orchestrator',
    tag: 'AI Path Showcase',
    status: 'planned',
    description:
      'An agent orchestrator that deliberately explores multiple reasoning paths in parallel rather than committing to a single chain. Unlike a standard ReAct loop, this shows the branching — each path makes different tool choices, reaches different conclusions, and the orchestrator weighs them before responding.',
    why: 'The current ReAct agent is deterministic: one path, one answer. Real decision-making isn\'t like that. This makes the branching visible and comparable in the UI.',
    approach: [
      'Fan out to N parallel Claude calls with different system prompts / temperatures',
      'Each branch independently decides which tools to call and in what order',
      'Orchestrator evaluates branch outputs, surfaces agreement vs divergence',
      'UI shows all branches side-by-side with final synthesized answer',
      'Use case: home automation queries where the "right" answer depends on context',
    ],
    stack: ['Go', 'Claude API', 'goroutines', 'Next.js'],
  },
  {
    id: 2,
    icon: Wind,
    color: 'text-sky-400',
    border: 'border-sky-800/50',
    bg: 'bg-sky-900/10',
    badge: 'bg-sky-900/40 text-sky-300 border-sky-700/50',
    title: 'Airflow Data Pipeline',
    tag: 'Data Engineering',
    status: 'planned',
    description:
      'Replace the current asynq/Redis cron jobs with Apache Airflow DAGs. The goal isn\'t just scheduling — it\'s making the data pipeline templatable and visible. Every scrape, sync, and agent run becomes a node in a graph with retries, alerts, and a real audit trail.',
    why: 'asynq is lightweight but opaque. Airflow gives you DAG versioning, task-level retries, backfill, dependency modeling, and a UI to watch it all. Also lets the Journey page pull real pipeline run history instead of hardcoded milestones.',
    approach: [
      'Airflow running in Docker alongside existing services',
      'DAGs: daily Cyclebar scrape, content generation, Instagram post, finance summary',
      'Journey page pulls from Airflow API — real run times replace hardcoded durations',
      'Template library: each DAG becomes a reusable pattern for future pipelines',
      'XCom to pass workout data → content agent → post in a single DAG',
    ],
    stack: ['Apache Airflow', 'Python', 'Docker', 'Airflow REST API', 'PostgreSQL'],
  },
  {
    id: 4,
    icon: RefreshCw,
    color: 'text-amber-400',
    border: 'border-amber-800/50',
    bg: 'bg-amber-900/10',
    badge: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
    title: 'SDACE Agent Loop',
    tag: 'Agent Architecture',
    status: 'planned',
    description:
      'A 5-stage agent lifecycle — Sense → Decide → Act → Communicate → Evolve — as a replacement for the current ReAct loop. ReAct covers Decide + Act + Observe. SDACE adds structured context loading at the front and output synthesis + memory updates at the back.',
    why: 'The current ReAct agent starts reasoning immediately without explicitly loading context (recent workouts, home state, prior runs). And it stops at returning an answer — it doesn\'t synthesize output for an audience or update memory from what it learned. SDACE makes those stages explicit and testable.',
    approach: [
      'Sense: load relevant context before reasoning — recent agent runs, device states, user history',
      'Decide: ReAct planning loop (unchanged from current)',
      'Act: tool execution (unchanged from current)',
      'Communicate: post-processing pass — format output for the specific audience / channel (UI, Instagram, summary)',
      'Evolve: write-back step — update a lightweight memory store with what was learned this run',
      'Each stage has a clear interface so stages can be swapped or extended independently',
      'Apply to both HA agent and content agent — same loop, different tools',
    ],
    stack: ['Go', 'Claude API', 'PostgreSQL', 'Redis'],
  },
  {
    id: 3,
    icon: ShieldCheck,
    color: 'text-emerald-400',
    border: 'border-emerald-800/50',
    bg: 'bg-emerald-900/10',
    badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
    title: 'Claude Validation Layer',
    tag: 'Code Quality / Anti-Hallucination',
    status: 'planned',
    description:
      'A second Claude pass that reviews code Claude just wrote — checking for hallucinated APIs, over-engineered abstractions, unused parameters, and unnecessary dependencies. The reviewer prompt is specifically adversarial: assume the code is wrong until proven otherwise.',
    why: 'Claude Code is fast but not infallible. It sometimes invents package APIs, adds error handling for cases that can\'t happen, or creates abstractions for one-time operations. A validation pass before committing catches this before it ships.',
    approach: [
      'Post-generation hook: after Claude writes code, feed the diff to a reviewer Claude instance',
      'Reviewer checks: does this API actually exist? Is this abstraction used more than once? Are these imports real?',
      'Output: annotated diff with confidence scores per block',
      'Red flags auto-surfaced in UI: "this method signature doesn\'t exist in the library"',
      'Optional: run against existing codebase to find prior hallucinations',
    ],
    stack: ['Claude API', 'Go', 'AST parsing', 'Claude Code hooks'],
  },
]

const STATUS_LABEL: Record<string, string> = {
  planned: 'Planned',
  'in-progress': 'In Progress',
  done: 'Done',
}

export default function TodosPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb size={20} className="text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Ideas & Todos</h1>
        </div>
        <p className="text-sm text-neutral-400">
          Tracked ideas for enavu-hub — things worth building, with enough context to actually start them.
        </p>
      </div>

      <div className="space-y-6">
        {IDEAS.map((idea) => {
          const Icon = idea.icon
          return (
            <div key={idea.id} className={`rounded-lg border ${idea.border} ${idea.bg} p-5`}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${idea.border} ${idea.bg}`}>
                  <Icon size={16} className={idea.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-white">{idea.title}</h2>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${idea.badge}`}>
                      {idea.tag}
                    </span>
                    <span className="inline-flex items-center rounded border border-neutral-700 bg-neutral-800/50 px-1.5 py-0.5 text-[10px] text-neutral-400">
                      {STATUS_LABEL[idea.status]}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-neutral-300 mb-3">{idea.description}</p>

              <div className="mb-3">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Why</p>
                <p className="text-xs text-neutral-400">{idea.why}</p>
              </div>

              <div className="mb-3">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Approach</p>
                <ul className="space-y-1">
                  {idea.approach.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-neutral-400">
                      <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${idea.color.replace('text-', 'bg-')}`} />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {idea.stack.map((s) => (
                  <span key={s} className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 font-mono">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
