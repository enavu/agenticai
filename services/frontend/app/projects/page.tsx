import { ExternalLink, Github } from 'lucide-react'

const PROJECTS = [
  {
    name: 'gmail-cleaner',
    tagline: 'AI-powered inbox zero',
    description: 'CLI script that uses Claude Haiku to classify and delete unwanted emails. Fetches up to 3,000 inbox emails and 5,000 promotions in batches of 20, asks Claude to decide keep vs delete, shows a preview, then moves them to Trash. Rescues important emails misclassified by Gmail (receipts, travel, legal) before deleting anything.',
    status: 'Script',
    statusColor: 'text-blue-400 bg-blue-400/10',
    url: null,
    github: null,
    stack: ['Python', 'Claude Haiku', 'Gmail API', 'Google OAuth'],
    stats: [
      { label: 'Inbox limit', value: '3,000' },
      { label: 'Promos limit', value: '5,000' },
      { label: 'Batch size', value: '20/call' },
      { label: 'Model', value: 'Haiku' },
    ],
    highlights: [
      'Classifies inbox + Promotions folder separately with different prompts',
      'Rescues important emails before deleting (receipts, security, travel)',
      'Preview + confirmation before any deletion — nothing permanent',
      'Moves to Trash (not hard delete) — recoverable for 30 days',
      'Batch API calls to Claude Haiku for speed and cost efficiency',
    ],
  },
  {
    name: 'enavu-hub',
    tagline: 'AI personal automation hub',
    description: 'Self-hosted platform that connects my fitness data, home automation, and AI agents. Scrapes Cyclebar workout history, controls Home Assistant devices via natural language chat, and auto-generates Instagram content from workout data.',
    status: 'Live',
    statusColor: 'text-emerald-400 bg-emerald-400/10',
    url: 'https://enavu.io',
    github: null,
    stack: ['Go', 'Next.js', 'Python', 'PostgreSQL', 'Redis', 'Claude API', 'Playwright', 'Docker'],
    stats: [
      { label: 'Build time', value: '~9h active' },
      { label: 'Planning', value: '4 weeks' },
      { label: 'Rides tracked', value: '738+' },
      { label: 'Services', value: '5' },
    ],
    highlights: [
      'ReAct agent loop — thinks, calls tools, observes, repeats',
      'Cyclebar scraper via Playwright — 738 rides, 212k+ calories',
      'WebSocket chat with Home Assistant tool calls',
      'Instagram content agent — generates + posts from workout data',
      'HMAC-SHA256 session auth, zero new deps',
      'Self-hosted on Mac: Caddy + Cloudflare + UniFi',
    ],
  },
]

export default function ProjectsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Projects</h1>
        <p className="text-sm text-neutral-400 mt-1">Things I've built.</p>
      </div>

      <div className="space-y-6">
        {PROJECTS.map((project) => (
          <div key={project.name} className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white">{project.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${project.statusColor}`}>
                    {project.status}
                  </span>
                </div>
                <p className="text-sm text-neutral-400 mt-0.5">{project.tagline}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {project.github && (
                  <a href={project.github} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 transition-colors">
                    <Github size={13} /> GitHub
                  </a>
                )}
                {project.url && (
                  <a href={project.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-white bg-neutral-700 hover:bg-neutral-600 transition-colors">
                    <ExternalLink size={13} /> Visit
                  </a>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-neutral-300 leading-relaxed">{project.description}</p>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {project.stats.map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-center">
                  <p className="text-sm font-bold text-white">{value}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Highlights */}
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-2">Highlights</p>
              <ul className="space-y-1.5">
                {project.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            {/* Stack */}
            <div className="flex flex-wrap gap-1.5">
              {project.stack.map((tech) => (
                <span key={tech} className="rounded px-2 py-0.5 text-xs bg-neutral-800 text-neutral-400">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
