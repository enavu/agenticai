'use client'

import { useState, useEffect, useRef } from 'react'
import { WS_URL } from '@/lib/api'
import { Send, Bot, User, Wrench, Brain, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant' | 'step'
  content: string
  stepType?: string
  toolName?: string
  agentRunId?: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [thinking, setThinking] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const convIdRef = useRef<string | null>(null)

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/chat`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => { setConnected(false); setThinking(false) }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'connected') {
          convIdRef.current = msg.conversation_id
          addMsg({ role: 'assistant', content: msg.content })
          return
        }
        if (msg.type === 'thinking') {
          setThinking(true)
          return
        }
        if (msg.type === 'step') {
          setThinking(true)
          addMsg({ role: 'step', content: msg.content, stepType: msg.step_type, toolName: msg.tool_name, agentRunId: msg.agent_run_id })
          return
        }
        if (msg.type === 'message') {
          setThinking(false)
          addMsg({ role: 'assistant', content: msg.content, agentRunId: msg.agent_run_id })
        }
      } catch {}
    }

    return () => ws.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  function addMsg(partial: Omit<ChatMsg, 'id'>) {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), ...partial }])
  }

  function sendMessage() {
    const text = input.trim()
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'message', content: text }))
    addMsg({ role: 'user', content: text })
    setInput('')
    setThinking(true)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 100px)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Home Assistant Chat</h1>
          <p className="text-sm text-neutral-400">Claude-powered ReAct agent for smart home control</p>
        </div>
        <div className={clsx('flex items-center gap-1.5 text-xs', connected ? 'text-emerald-400' : 'text-red-400')}>
          <div className={clsx('h-2 w-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-red-400')} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4 space-y-3">
        {messages.map((msg) => {
          if (msg.role === 'step') {
            return (
              <div key={msg.id} className="flex gap-2 items-start opacity-70">
                <div className="shrink-0 mt-0.5">
                  {msg.stepType === 'thinking'
                    ? <Brain size={13} className="text-purple-400" />
                    : <Wrench size={13} className="text-blue-400" />}
                </div>
                <div className="text-xs text-neutral-400 font-mono">
                  {msg.toolName && <span className="text-blue-300 mr-1">[{msg.toolName}]</span>}
                  {msg.content}
                </div>
              </div>
            )
          }

          return (
            <div
              key={msg.id}
              className={clsx(
                'flex gap-3',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div className={clsx(
                'shrink-0 h-7 w-7 rounded-full flex items-center justify-center',
                msg.role === 'user' ? 'bg-blue-600' : 'bg-neutral-800'
              )}>
                {msg.role === 'user'
                  ? <User size={14} className="text-white" />
                  : <Bot size={14} className="text-neutral-300" />}
              </div>
              <div className={clsx(
                'max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-200'
              )}>
                {msg.content}
                {msg.agentRunId && (
                  <a
                    href={`/agents?run=${msg.agentRunId}`}
                    className="block mt-1 text-xs opacity-60 hover:opacity-100 underline"
                  >
                    View agent trace →
                  </a>
                )}
              </div>
            </div>
          )
        })}

        {thinking && (
          <div className="flex gap-3">
            <div className="shrink-0 h-7 w-7 rounded-full bg-neutral-800 flex items-center justify-center">
              <Loader2 size={14} className="text-neutral-300 animate-spin" />
            </div>
            <div className="bg-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-400">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={!connected}
          placeholder={connected ? 'Ask about your home… (Enter to send)' : 'Connecting…'}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-blue-600 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          <Send size={16} />
        </button>
      </div>

      <p className="mt-2 text-xs text-neutral-600">
        Try: "What lights are on?" · "Dim the bedroom to 20%" · "Turn on rest mode"
      </p>
    </div>
  )
}
