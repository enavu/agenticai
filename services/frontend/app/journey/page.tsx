import { Clock, GitBranch, Zap, Terminal, Lock, Rocket, Brain, Camera, DollarSign, Lightbulb, RefreshCw, Linkedin, Database } from 'lucide-react'

const STATS = [
  { label: 'Total active', value: '~12h' },
  { label: 'Planning phase', value: '~4h' },
  { label: 'Build phase', value: '~8h' },
  { label: 'Lines of code', value: '~5,500' },
  { label: 'Services', value: '5' },
  { label: 'Time span', value: '8 weeks' },
]

const SESSIONS = [
  {
    date: 'Feb – Mar 3, 2026',
    duration: '~4h planning',
    icon: Brain,
    color: 'text-violet-400',
    border: 'border-violet-800/40',
    bg: 'bg-violet-900/10',
    title: 'Architecture Planning (AI-Native)',
    description: 'Four weeks of daily Claude conversations — not coding, thinking. Used Claude\'s full context window to design the system end-to-end: services, data model, agent architecture, ADRs. Short sessions (~30 min each) but deep reasoning. The implementation was fast because the design was done.',
    milestones: ['System design & service boundaries', 'ADR-driven decision making', 'ReAct agent loop design', 'Data model & schema planned', 'All decisions documented before a single line of code'],
  },
  {
    date: 'Mar 3, 2026',
    duration: '76 min',
    icon: GitBranch,
    color: 'text-purple-400',
    border: 'border-purple-800/40',
    bg: 'bg-purple-900/10',
    title: 'Architecture & Scaffold',
    description: 'Designed the full system — Go API, Python scraper, Next.js frontend, Postgres, Redis, two AI agents. Scaffolded all 5 services with Docker Compose.',
    milestones: ['ReAct agent architecture planned', 'docker-compose.yml with all services', 'Go module structure (cmd/internal/pkg)', 'Next.js App Router with Tailwind'],
  },
  {
    date: 'Mar 10, 2026',
    duration: '81 min',
    icon: Zap,
    color: 'text-blue-400',
    border: 'border-blue-800/40',
    bg: 'bg-blue-900/10',
    title: 'Agents & Live Chat',
    description: 'Built the core ReAct orchestrator loop, Home Assistant tools, and WebSocket chat — "What lights are on?" → agent reasons → calls HA → streams answer back.',
    milestones: ['ReAct orchestrator.go (think→act→observe)', 'ha_tools.go — 6 HA tools', 'WebSocket hub + streaming', 'Live chat UI with agent step display'],
  },
  {
    date: 'Mar 17–25, 2026',
    duration: '~40 min',
    icon: Terminal,
    color: 'text-yellow-400',
    border: 'border-yellow-800/40',
    bg: 'bg-yellow-900/10',
    title: 'Debugging & Refinement',
    description: 'Fixed Docker credential helpers, Makefile paths, scraper Dockerfile. Multiple short sessions ironing out the build pipeline.',
    milestones: ['Docker build pipeline stable', 'Health endpoint wired up', 'Dashboard caching fixed (force-dynamic)', 'API error handling improved'],
  },
  {
    date: 'Mar 25, 2026',
    duration: '107 min',
    icon: Terminal,
    color: 'text-emerald-400',
    border: 'border-emerald-800/40',
    bg: 'bg-emerald-900/10',
    title: 'Cyclebar Scraper Breakthrough',
    description: 'Reverse-engineered the Cyclebar members portal. Discovered the correct attendance URL by capturing nav links post-login. Rewrote parser to use a single JS evaluation — 737 rides scraped in ~5s instead of 100s+.',
    milestones: ['Found correct URL: /history/attendance/cyclebar-lohi', 'Single page.evaluate() for all 737 rows', '212,245 total calories imported', 'FastAPI scraper endpoint stable'],
  },
  {
    date: 'Apr 10, 2026',
    duration: '136 min',
    icon: Lock,
    color: 'text-orange-400',
    border: 'border-orange-800/40',
    bg: 'bg-orange-900/10',
    title: 'Auth & Production Deploy',
    description: 'Added HMAC-SHA256 session auth (zero new deps), fixed login page proxy routing in Next.js standalone mode, then deployed live: Caddy + Cloudflare + UniFi port forwarding.',
    milestones: ['HMAC-SHA256 signed cookies', 'Next.js Route Handler proxy for auth', 'Caddy reverse proxy + auto-SSL', 'Cloudflare DNS + UniFi port forwarding'],
  },
  {
    date: 'Apr 10, 2026',
    duration: '30 min',
    icon: Rocket,
    color: 'text-white',
    border: 'border-white/20',
    bg: 'bg-white/5',
    title: 'Production Setup',
    description: 'Wired up Caddy + Cloudflare + UniFi port forwarding. Nameservers pointing at Cloudflare, A record set, Caddy configured. Let\'s Encrypt ACME challenges silently failing behind Cloudflare proxy — site not yet live.',
    milestones: ['Cloudflare DNS + proxy configured', 'UniFi port forwarding 80/443 → Mac', 'Caddy reverse proxy config', 'ACME challenge blocked by CF proxy (unknown at this point)'],
  },
  {
    date: 'Apr 11, 2026',
    duration: '~90 min',
    icon: Terminal,
    color: 'text-cyan-400',
    border: 'border-cyan-800/40',
    bg: 'bg-cyan-900/10',
    title: 'Go-Live Debug: DNS → Traefik',
    description: 'Traced 404 through every layer. Cloudflare DNS had wrong origin IP. Let\'s Encrypt can\'t complete ACME challenges behind Cloudflare proxy — switched to Cloudflare Origin Certificate. Final blocker: Rancher Desktop\'s Kubernetes was running Traefik on ports 80/443, intercepting all traffic before Caddy. Disabled K8s, Caddy took over, site went live.',
    milestones: ['Cloudflare A record corrected: 50.116.65.218 → 98.38.189.165', 'Cloudflare Origin Cert replacing Let\'s Encrypt', 'Diagnosed Traefik (Rancher Desktop K8s) hijacking port 443', 'Disabled Kubernetes in Rancher Desktop', 'enavu.io live with real workout data'],
  },
  {
    date: 'Apr 13–14, 2026',
    duration: '~2h',
    icon: Camera,
    color: 'text-pink-400',
    border: 'border-pink-800/40',
    bg: 'bg-pink-900/10',
    title: 'Instagram API: The Hard Way',
    description: 'Getting an Instagram access token took longer than building the entire Cyclebar scraper. Meta\'s developer portal is a maze of broken UIs, silent blockers, and misleading errors. Every step below was a wall we hit before finding the door. Documented as a runbook — if you\'re doing this fresh, follow these steps in order.',
    milestones: [
      'STEP 1 — Create a Meta developer account at developers.facebook.com',
      'STEP 2 — Create a NEW app. When asked type, choose "Other" → "Business". Do not use an existing app — the type can\'t be changed after creation and the portal breaks in ways that aren\'t recoverable.',
      'STEP 3 — App Settings → Basic: fill in Privacy Policy URL (any URL works, e.g. your domain). Without this, you cannot add Instagram as a use case. The portal gives no indication this is the blocker.',
      'STEP 4 — In Meta Business Suite (business.facebook.com), make sure your Business Portfolio has at least one asset connected (a Page or Instagram account). If it shows 0 assets, the developer portal Use cases panel will appear blank or broken.',
      'STEP 5 — Use cases → Add → "Manage messaging & content on Instagram". If this panel is blank or unresponsive, your app type is wrong — create a new Business-type app.',
      'STEP 6 — Your Instagram account must be Business or Creator type (not Personal). In the Instagram app: Settings → Account type and tools → Switch to Professional account.',
      'STEP 7 — App Roles → Roles → More dropdown → "Instagram Testers" → add your Instagram username (@handle). This step is not obvious — it\'s hidden under "More", not under the main Testers tab.',
      'STEP 8 — Accept the tester invite. Go to instagram.com/accounts/manage_access/ in a browser → "Tester Invites" tab → Accept. The Instagram app\'s Settings UI often doesn\'t show this — use the web URL.',
      'STEP 9 — Back in the developer portal: Use cases → Instagram use case → "API setup with Instagram login" → Step 2 "Generate access tokens" → "Add account" → your Instagram account should now appear. Click "Generate token".',
      'STEP 10 — Copy the token. It\'s short-lived (~60 days). For a long-lived token: GET graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret={IG_APP_SECRET}&access_token={SHORT_TOKEN}. Note: use graph.instagram.com (not graph.facebook.com) and the Instagram App Secret (not the Facebook App Secret).',
      'STEP 11 — Your Instagram User ID is shown on that same page next to your account name. Also visible in Meta Business Suite → Instagram accounts.',
      'STEP 12 — Instagram Graph API requires image_url for all feed posts — there is no text-only post via API. You need a publicly accessible image URL. Built: POST /api/v1/uploads saves to a Docker volume, GET /api/v1/files/:filename serves it publicly at enavu.io/api/v1/files/.',
      'RESULT — Posts page: pick photo from laptop → uploads to server → agent generates caption from recent workouts → posts to Instagram with the image. First post live ✓',
    ],
  },
  {
    date: 'Apr 21, 2026',
    duration: '~45 min',
    icon: DollarSign,
    color: 'text-green-400',
    border: 'border-green-800/40',
    bg: 'bg-green-900/10',
    title: 'Finance Tracker (Login-Only Feature)',
    description: 'Built a private accountability tracker for a 3-year lease agreement — only visible after login. Needed a way to see where things stood at a glance without recalculating manually. Took the opportunity to make it smart: status (on-time, late, partial, missed) is auto-computed from dates and amounts, not manually selected. Includes a live preview in the form so you see the label before saving.',
    milestones: [
      'lease_agreements + lease_payments tables with auto-migrate',
      'Status auto-computed server-side from due date vs paid date + amounts',
      'Reliability score: weighted average across all payments (on-time=100, late=70, partial=50, missed=0)',
      'Progress bar with months elapsed vs term length',
      'Edit payment modal — corrects wrong dates without losing history',
      'Finance nav link appears only when authenticated',
    ],
  },
  {
    date: 'Apr 24, 2026',
    duration: '~1h',
    icon: Database,
    color: 'text-cyan-400',
    border: 'border-cyan-800/40',
    bg: 'bg-cyan-900/10',
    title: 'HA State Historian — 782 Devices, Every 15 Min',
    description: 'Foundation of the Life Intelligence stack. Added a cron job that snapshots all 782 Home Assistant entities to Postgres every 15 minutes — security cameras, motion sensors, door contacts, automations, audio detectors, climate, lights. First snapshot ran at 15:15 UTC. By tomorrow: ~96 snapshots. By next week: enough data for Claude to start reading patterns in how the home actually lives.',
    milestones: [
      'ha_snapshots table already in schema — added captured_at index for fast time-range queries',
      'CreateHASnapshot / ListHASnapshots store methods',
      'ha:snapshot asynq cron (*/15 * * * *) → GetAllStates → JSONB → Postgres',
      'GET /api/v1/home/history?hours=24&limit=96 endpoint wired',
      'First snapshot: 782 entities captured — cameras, sensors, doors, automations, microphones',
      'Unlocks: Life Pattern Observer, Morning Briefing, Proactive Suggestions, Anomaly Detector',
    ],
  },
  {
    date: 'Apr 14, 2026',
    duration: '~20 min',
    icon: Terminal,
    color: 'text-emerald-400',
    border: 'border-emerald-800/40',
    bg: 'bg-emerald-900/10',
    title: 'Postgres Backups → Google Drive',
    description: 'Postgres data lives in a Docker volume — safe across restarts, but lost if the volume is deleted or the machine dies. Added a daily automated backup: pg_dump → gzip → rclone sync to Google Drive. Runs at 2am, keeps 30 days of local copies, logs to backups/backup.log.',
    milestones: [
      'brew install rclone',
      'rclone config → authenticate Google Drive via browser OAuth',
      'backup.sh: docker exec pg_dump | gzip → rclone copy to gdrive:enavu-hub-backups',
      'crontab -e: 0 2 * * * runs daily at 2am',
      'Test run: 60K dump synced to Google Drive in 2s ✓',
      'Restore: gunzip -c backup.sql.gz | docker exec -i postgres psql -U enavu enavu_hub',
    ],
  },
]

export default function JourneyPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Build Journey</h1>
        <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
          enavu-hub was built entirely with Claude Code across 5 weeks.
          The first 4 weeks were architecture and planning — short daily sessions using Claude's full context window to design the system,
          write ADRs, and think through tradeoffs. The final week was implementation: ~5 hours of actual coding to bring it all to life.
          Total active time: <span className="text-white">~9 hours</span>, calculated from Claude conversation log timestamps
          using the same method as these session durations.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STATS.map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-center">
            <p className="text-lg font-bold text-white">{value}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-neutral-800" />

        <div className="space-y-6">
          {SESSIONS.map((session, i) => {
            const Icon = session.icon
            return (
              <div key={i} className="relative pl-14">
                {/* Icon dot */}
                <div className={`absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border ${session.border} ${session.bg}`}>
                  <Icon size={18} className={session.color} />
                </div>

                <div className={`rounded-lg border ${session.border} ${session.bg} p-4`}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{session.title}</h3>
                      <p className="text-xs text-neutral-500 mt-0.5">{session.date}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-xs text-neutral-400">
                      <Clock size={12} />
                      {session.duration}
                    </div>
                  </div>

                  <p className="text-sm text-neutral-300 mb-3">{session.description}</p>

                  <ul className="space-y-1">
                    {session.milestones.map((m, j) => (
                      <li key={j} className="flex items-center gap-2 text-xs text-neutral-400">
                        <span className={`h-1 w-1 rounded-full ${session.color.replace('text-', 'bg-')}`} />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Planned section */}
      <div className="pt-4">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={16} className="text-yellow-400" />
          <h2 className="text-base font-semibold text-white">What's Next</h2>
          <span className="text-xs text-neutral-500">tracked in <a href="/todos" className="text-neutral-400 hover:text-white transition-colors underline underline-offset-2">Todos</a></span>
        </div>

        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px border-l border-dashed border-neutral-700" />
          <div className="space-y-4">
            {[
              {
                icon: GitBranch,
                color: 'text-violet-400',
                border: 'border-violet-800/30',
                bg: 'bg-violet-900/5',
                title: 'Nondeterministic Orchestrator',
                description: 'Multi-path ReAct agent that fans out to N parallel Claude calls, compares branches, and synthesizes the divergence — making the reasoning visible in UI.',
              },
              {
                icon: RefreshCw,
                color: 'text-amber-400',
                border: 'border-amber-800/30',
                bg: 'bg-amber-900/5',
                title: 'SDACE Agent Loop',
                description: 'Refactor the ReAct agent into a 5-stage lifecycle: Sense (context load) → Decide → Act → Communicate (audience-aware output) → Evolve (memory write-back).',
              },
              {
                icon: Linkedin,
                color: 'text-blue-400',
                border: 'border-blue-800/30',
                bg: 'bg-blue-900/5',
                title: 'LinkedIn Post Automation',
                description: 'Same content agent pattern as Instagram but routed to LinkedIn — professional tone, data-forward captions, Mon/Wed/Fri cadence via asynq.',
              },
              {
                icon: () => <span className="text-sky-400 text-xs font-bold">AF</span>,
                color: 'text-sky-400',
                border: 'border-sky-800/30',
                bg: 'bg-sky-900/5',
                title: 'Airflow Data Pipeline',
                description: 'Replace asynq cron with Apache Airflow DAGs. Real pipeline visibility, retries, backfill, and a template library for future pipelines.',
              },
              {
                icon: () => <span className="text-emerald-400 text-xs font-bold">CV</span>,
                color: 'text-emerald-400',
                border: 'border-emerald-800/30',
                bg: 'bg-emerald-900/5',
                title: 'Claude Validation Layer',
                description: 'Adversarial second-pass reviewer: checks Claude-written code for hallucinated APIs, over-engineered abstractions, and unnecessary complexity before it ships.',
              },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="relative pl-14 opacity-70">
                  <div className={`absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border border-dashed ${item.border}`}>
                    <Icon size={16} className={item.color} />
                  </div>
                  <div className={`rounded-lg border border-dashed ${item.border} ${item.bg} p-4`}>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-neutral-300 text-sm">{item.title}</h3>
                      <span className="text-[10px] text-neutral-600 border border-neutral-700 rounded px-1.5 py-0.5">planned</span>
                    </div>
                    <p className="text-xs text-neutral-500">{item.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-600 pb-8">
        Session durations calculated from Claude Code conversation logs (~/.claude/projects/). All code written in VS Code with Claude Code CLI.
      </p>
    </div>
  )
}
