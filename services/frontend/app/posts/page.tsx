'use client'

import { useState, useEffect } from 'react'
import { api, type Post } from '@/lib/api'
import { Sparkles, Instagram, Clock } from 'lucide-react'

const statusColors: Record<Post['status'], string> = {
  draft: 'text-yellow-400 bg-yellow-400/10',
  published: 'text-emerald-400 bg-emerald-400/10',
  failed: 'text-red-400 bg-red-400/10',
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api.posts.list()
      setPosts(res.posts ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenResult(null)
    try {
      const res = await api.posts.generate()
      setGenResult(`Agent run ${res.agent_run_id} completed. Status: ${res.status}`)
      await load()
    } catch (e: any) {
      setGenResult('Failed: ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Instagram Posts</h1>
          <p className="text-sm text-neutral-400 mt-1">AI-generated content from workout data</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
        >
          <Sparkles size={15} className={generating ? 'animate-pulse' : ''} />
          {generating ? 'Running agent…' : 'Generate Post'}
        </button>
      </div>

      {genResult && (
        <div className="rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm text-neutral-300">
          {genResult}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 text-sm">
          No posts yet. Click "Generate Post" to create your first AI-generated caption.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <div key={post.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-pink-400">
                  <Instagram size={15} />
                  <span className="text-xs font-medium">Instagram</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[post.status]}`}>
                  {post.status}
                </span>
              </div>

              <p className="text-sm text-neutral-200 leading-relaxed line-clamp-4">{post.caption}</p>

              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Clock size={12} />
                {new Date(post.created_at).toLocaleDateString()}
                {post.instagram_id && (
                  <span className="ml-auto text-emerald-400">ID: {post.instagram_id}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
