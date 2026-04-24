import { Lightbulb, GitBranch, Wind, ShieldCheck, RefreshCw, Linkedin, Database, Eye, Zap, Sun, AlertTriangle } from 'lucide-react'

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
    id: 5,
    icon: Linkedin,
    color: 'text-blue-400',
    border: 'border-blue-800/50',
    bg: 'bg-blue-900/10',
    badge: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
    title: 'LinkedIn Post Automation',
    tag: 'Content / Social',
    status: 'planned',
    description:
      'Auto-post to LinkedIn on a schedule — same pattern as Instagram but for professional content. Career updates, project milestones, AI/data insights pulled from enavu-hub activity. Content agent generates the post, asynq queues the delivery.',
    why: 'Instagram is visual + personal. LinkedIn is professional reach. The content agent already generates captions — routing a version to LinkedIn is mostly wiring, not new logic.',
    approach: [
      'Create LinkedIn app at developer.linkedin.com, request w_member_social permission',
      'OAuth2 flow to get access token (stored in env, ~60 day refresh cycle)',
      'POST to api.linkedin.com/v2/ugcPosts — text + optional image via asset upload',
      'New content agent prompt variant: professional tone, data-forward, first-person',
      'asynq cron: generate + post on a Mon/Wed/Fri cadence (separate from Instagram Tue/Thu)',
      'Posts page: toggle between Instagram and LinkedIn drafts',
      'Blocker: w_member_social permission may require LinkedIn use case review (days to weeks)',
    ],
    stack: ['Go', 'LinkedIn API', 'Claude API', 'asynq', 'OAuth2'],
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

const LIFE_INTELLIGENCE: typeof IDEAS = [
  {
    id: 6,
    icon: Database,
    color: 'text-cyan-400',
    border: 'border-cyan-800/50',
    bg: 'bg-cyan-900/10',
    badge: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
    title: 'HA State Historian',
    tag: 'Foundation · Build First',
    status: 'planned',
    description:
      'Snapshot Home Assistant state to Postgres every 15–30 minutes. Without this, there is no history — just what\'s on right now. Everything else in the life intelligence stack depends on this data existing.',
    why: 'The current HA integration only reads live state. You can ask "what lights are on?" but not "what was on at 10pm last Tuesday?" Pattern learning, anomaly detection, and briefings all need a historical record.',
    approach: [
      'New asynq cron task: runs every 15 min, calls HA /api/states, writes to ha_snapshots table',
      'Schema: entity_id, state, attributes (jsonb), recorded_at — partitioned by day',
      'Index on entity_id + recorded_at for fast range queries',
      'Retention policy: keep full granularity for 30 days, downsample to hourly after',
      'API endpoint: GET /api/v1/home/history?entity=light.office&from=&to=',
      'No Airflow needed yet — asynq handles this cleanly',
    ],
    stack: ['Go', 'asynq', 'PostgreSQL', 'Home Assistant API'],
  },
  {
    id: 7,
    icon: Eye,
    color: 'text-violet-400',
    border: 'border-violet-800/50',
    bg: 'bg-violet-900/10',
    badge: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
    title: 'Life Pattern Observer',
    tag: 'Life Intelligence',
    status: 'planned',
    description:
      'Runs on a schedule, queries the HA history, and Claude narrates what it sees in plain English. Observations accumulate in Postgres — a growing log of learned facts about your life at home.',
    why: 'You have 505 devices generating continuous state data but no intelligence layer reading it. This turns raw device history into legible patterns: when you\'re home, your routines, how your space is actually used.',
    approach: [
      'Weekly cron: pull last 7 days of ha_snapshots, pass to Claude with observation prompt',
      'Claude identifies: presence patterns, routine times, notable deviations, energy waste candidates',
      'Store observations in life_observations table: entity_group, observation, confidence, period',
      'Dashboard card: "What Claude noticed this week" — plain English summary',
      'Observations feed into suggestion agent as learned context (Sense stage of SDACE)',
    ],
    stack: ['Go', 'Claude API', 'PostgreSQL', 'asynq'],
  },
  {
    id: 8,
    icon: Zap,
    color: 'text-yellow-400',
    border: 'border-yellow-800/50',
    bg: 'bg-yellow-900/10',
    badge: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
    title: 'Proactive Suggestion Agent',
    tag: 'Life Intelligence',
    status: 'planned',
    description:
      'Combines current home state + learned observations + time of day to surface contextual suggestions — or act automatically on rules you\'ve approved. The first real SDACE implementation: Sense → Decide → Act → Communicate → Evolve.',
    why: 'The current chat agent is reactive — you ask, it responds. This flips it: the agent watches, notices something worth acting on, and brings it to you. Or just does it if you\'ve said "always turn off office lights after midnight."',
    approach: [
      'Cron every 30 min: load current state + recent observations + time context',
      'Claude evaluates: is anything worth flagging or acting on right now?',
      'Output: suggestion card on dashboard with Approve / Dismiss / Always do this',
      '"Always do this" creates a rule stored in Postgres — future runs execute without prompting',
      'Full SDACE loop: Sense (state + observations) → Decide (Claude) → Act (HA tool call) → Communicate (dashboard card) → Evolve (store rule)',
    ],
    stack: ['Go', 'Claude API', 'Home Assistant API', 'PostgreSQL'],
  },
  {
    id: 9,
    icon: Sun,
    color: 'text-orange-400',
    border: 'border-orange-800/50',
    bg: 'bg-orange-900/10',
    badge: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
    title: 'Morning Briefing Agent',
    tag: 'Life Intelligence',
    status: 'planned',
    description:
      'Runs at 7am. Reads current home state, upcoming workout schedule, finance status, and any pending observations. Claude writes a 3-sentence brief. Shows on the dashboard as today\'s top card.',
    why: 'Everything in enavu-hub is a separate page. The briefing synthesizes it — one place to see where things stand across home, fitness, and finance without clicking around.',
    approach: [
      'asynq cron at 7am: pull home state snapshot + weekly workout summary + finance balance + open observations',
      'Claude prompt: "You are a personal briefing agent. Write 3 sentences covering what matters today."',
      'Store in daily_briefings table: date, content, sources_used',
      'Dashboard: today\'s briefing as the first card, previous briefings accessible',
      'Future: post to a webhook (Slack, SMS) so it reaches you without opening the app',
    ],
    stack: ['Go', 'Claude API', 'asynq', 'PostgreSQL'],
  },
  {
    id: 10,
    icon: AlertTriangle,
    color: 'text-red-400',
    border: 'border-red-800/50',
    bg: 'bg-red-900/10',
    badge: 'bg-red-900/40 text-red-300 border-red-700/50',
    title: 'Anomaly Detector',
    tag: 'Life Intelligence',
    status: 'planned',
    description:
      'Learns your baseline home behavior and flags when something is off. Thermostat unusually high, front door unlocked past midnight, a room that\'s always empty suddenly active at 3am. Silent and always watching.',
    why: 'Patterns are only useful if deviations are visible. This is the security and awareness layer — not replacing a real alarm system, but adding a Claude-native awareness of what\'s normal vs. what isn\'t.',
    approach: [
      'Build baseline: per entity, compute median state by hour-of-day and day-of-week from ha_snapshots',
      'Anomaly check cron (nightly): compare last 24h against baseline, flag outliers beyond threshold',
      'Claude classifies each anomaly: trivial / notable / urgent',
      'Notable+ stored in anomaly_log table, surfaced on dashboard',
      'Future: push notification for urgent anomalies (door unlocked, temp spike)',
    ],
    stack: ['Go', 'Claude API', 'PostgreSQL', 'asynq'],
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

      {[
        { label: 'Life Intelligence · Home Assistant', items: [...LIFE_INTELLIGENCE].reverse() },
        { label: 'AI & Infrastructure', items: [...IDEAS].reverse() },
      ].map(({ label, items }) => (
        <div key={label} className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{label}</h2>
          <div className="space-y-6">
            {items.map((idea) => {
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
      ))}
    </div>
  )
}
