'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CreditCard, History, Globe, Info } from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()

  const links = [
    { href: '/', icon: Home, label: 'Главная' },
    { href: '/plans', icon: CreditCard, label: 'Тарифы' },
    { href: '/history', icon: History, label: 'История' },
    { href: '/connect', icon: Globe, label: 'Подключение' },
    { href: '/info', icon: Info, label: 'Инфо' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {links.map((link) => {
          const isActive = pathname === link.href
          const Icon = link.icon
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
