'use client'

import { useState, useEffect, useRef } from 'react'
import { api, type Post } from '@/lib/api'
import { Sparkles, Instagram, Clock, ImagePlus, X } from 'lucide-react'

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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [imageURL, setImageURL] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api.posts.list()
      setPosts(res.posts ?? [])
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImageURL(null)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setImageURL(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenResult(null)
    try {
      let url = imageURL
      if (imageFile && !url) {
        setUploading(true)
        const res = await api.uploads.upload(imageFile)
        url = res.url
        setImageURL(url)
        setUploading(false)
      }
      const res = await api.posts.generate(url ?? undefined)
      setGenResult(res.output ?? `Agent run ${res.agent_run_id} completed.`)
      await load()
    } catch (e: any) {
      setGenResult('Failed: ' + e.message)
      setUploading(false)
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
      </div>

      {/* Image + Generate controls */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-3">
        <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">Photo (required to post)</p>
        <div className="flex items-start gap-3">
          {imagePreview ? (
            <div className="relative shrink-0">
              <img src={imagePreview} className="h-20 w-20 rounded-lg object-cover" />
              <button
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-neutral-700 p-0.5 hover:bg-neutral-600"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-700 hover:border-neutral-500 transition-colors"
            >
              <ImagePlus size={20} className="text-neutral-500" />
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div className="flex-1 space-y-2">
            <p className="text-sm text-neutral-300">
              {imageFile ? imageFile.name : 'Select a photo from your laptop to include in the Instagram post.'}
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              <Sparkles size={15} className={generating ? 'animate-pulse' : ''} />
              {uploading ? 'Uploading…' : generating ? 'Running agent…' : 'Generate Post'}
            </button>
          </div>
        </div>
      </div>

      {genResult && (
        <div className="rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-neutral-300 whitespace-pre-wrap">
          {genResult}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 text-sm">
          No posts yet. Add a photo and click "Generate Post".
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

              {post.image_url && (
                <img src={post.image_url} className="w-full rounded-lg object-cover max-h-40" />
              )}

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
