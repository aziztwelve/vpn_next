'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CreditCard, Globe, Home, Info, Users } from 'lucide-react'

// Bottom navigation для Mini App. Размеры на ~25% больше дефолтных
// (h-20 vs h-16, иконки w-6 h-6 vs w-5 h-5, text-sm vs text-xs) — чтобы
// тапы были комфортнее на мобилке. Цветовая схема и шрифты — из главной:
//   accent  → cyan-400 (как в page.tsx на BigActionCard tone='cyan')
//   surface → slate-900 / slate-800 (чуть темнее карточек, чтобы нав
//             визуально «приклеивался» к низу)
//   inactive → slate-400 hover:text-slate-100

export function BottomNav() {
  const pathname = usePathname()

  // 5 пунктов меню. История убрана (доступна со страницы Тарифы и из
  // профиля), вместо неё «Рефералка» — раздел реферальной программы
  // (приглашение друзей + партнёрский кабинет), чтобы был виден с
  // любого экрана. На главной соответствующая карточка остаётся
  // под другим текстом — здесь намеренно жаргонный лейбл, узнаваемый
  // в Telegram/VPN-аудитории.
  //
  // Админские разделы (Воронки и т.п.) живут не тут, а блоком на главной
  // ниже Устройств/Истории — чтобы обычный юзер даже не подозревал.
  const links: { href: string; icon: typeof Home; label: string }[] = [
    { href: '/', icon: Home, label: 'Главная' },
    { href: '/plans', icon: CreditCard, label: 'Тарифы' },
    { href: '/connect', icon: Globe, label: 'Подключение' },
    { href: '/referral', icon: Users, label: 'Рефералка' },
    { href: '/info', icon: Info, label: 'Инфо' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 safe-area-inset-bottom z-50">
      {/* h-[84px] = h-20 (80px) +5%. items-start + pt-2 поднимает
          иконку+лейбл ближе к верхней границе nav-бара, чтобы между
          подписью и низом экрана/safe-area оставался воздух. */}
      <div className="flex justify-around items-start h-[84px] pt-2 px-2">
        {links.map((link) => {
          // Точное совпадение для главной, prefix-match для остальных,
          // чтобы /plans/v2 тоже подсвечивал «Тарифы».
          const isActive =
            link.href === '/'
              ? pathname === '/'
              : pathname === link.href || pathname.startsWith(link.href + '/')
          const Icon = link.icon

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl min-w-[60px] transition-all ${
                isActive
                  ? 'text-cyan-400 bg-cyan-400/10'
                  : 'text-slate-400 hover:text-slate-100 active:bg-slate-800'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.25 : 1.75} />
              <span className={`text-[11px] leading-none font-medium ${isActive ? '' : 'text-slate-400'}`}>
                {link.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
