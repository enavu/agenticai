'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { Home, Dumbbell, Instagram, Bot, MessageSquare } from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/workouts', label: 'Workouts', icon: Dumbbell },
  { href: '/posts', label: 'Posts', icon: Instagram },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-neutral-800 bg-neutral-950">
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
        </div>
      </div>
    </nav>
  )
}
