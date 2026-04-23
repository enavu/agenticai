'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Home, Dumbbell, Instagram, Bot, MessageSquare, LogIn, LogOut, MapPin, Layers, DollarSign, Lightbulb } from 'lucide-react'

const publicLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/workouts', label: 'Workouts', icon: Dumbbell },
  { href: '/posts', label: 'Posts', icon: Instagram },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/journey', label: 'Journey', icon: MapPin },
  { href: '/projects', label: 'Projects', icon: Layers },
  { href: '/todos', label: 'Todos', icon: Lightbulb },
]

const privateLinks = [
  { href: '/finance', label: 'Finance', icon: DollarSign },
]

function getCookie(name: string) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    setAuthed(getCookie('enavu_authed') === '1')
  }, [pathname])

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setAuthed(false)
    router.push('/dashboard')
    router.refresh()
  }

  const links = authed ? [...publicLinks, ...privateLinks] : publicLinks

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden sm:block border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center gap-1">
            <Link href="/dashboard" className="mr-6 text-sm font-semibold text-white">
              enavu-hub
            </Link>
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                  pathname === href || pathname.startsWith(href + '/')
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
            <div className="ml-auto">
              {authed ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  <LogIn size={15} />
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile top bar */}
      <nav className="sm:hidden border-b border-neutral-800 bg-neutral-950 px-4 h-12 flex items-center">
        <span className="text-sm font-semibold text-white">enavu-hub</span>
        <div className="ml-auto">
          {authed ? (
            <button onClick={handleSignOut} className="p-1.5 text-neutral-400 hover:text-white">
              <LogOut size={16} />
            </button>
          ) : (
            <Link href="/login" className="p-1.5 text-neutral-400 hover:text-white">
              <LogIn size={16} />
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-neutral-950">
        <div className="flex">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors',
                  active ? 'text-white' : 'text-neutral-500'
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

    </>
  )
}
