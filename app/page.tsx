'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Globe, Shield, Smartphone, Users } from 'lucide-react';
import { ApiError, vpnApi, type Subscription } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TrialBanner } from '@/components/trial-banner';

// Tokens (синхронно с /connect):
//   page   — bg-slate-950
//   card   — bg-slate-800/50 + border-slate-700/50 (hover:border-slate-600)
//   accent — cyan-400 (основной), emerald-400 (активная подписка / "ок")
//   error border — border-red-500/40
//   radius — rounded-2xl

// ─────────────────────────────────────────────────────────────
// Closed beta gate
// ─────────────────────────────────────────────────────────────
// Главная пока закрыта для всех кроме whitelisted username'ов —
// бэкенд платежей ещё не подключён. Когда платёжная интеграция будет
// готова, удали PRIVATE_BETA_USERNAMES + соответствующий early-return
// в HomePage (или сделай Set пустым — тогда условие false для всех
// и гейт автоматом отключится).
type ActiveState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'active'; sub: Subscription }
  | { kind: 'error'; message: string };

export default function HomePage() {
  const { status, user, error: authError } = useAuth();
  const [active, setActive] = useState<ActiveState>({ kind: 'idle' });

  useEffect(() => {
    if (status !== 'authenticated') {
      setActive({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setActive({ kind: 'loading' });

    (async () => {
      try {
        const res = await vpnApi.getActiveSubscription();
        if (cancelled) return;
        if (res.has_active && res.subscription) {
          setActive({ kind: 'active', sub: res.subscription });
        } else {
          setActive({ kind: 'none' });
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Не удалось загрузить подписку';
        setActive({ kind: 'error', message: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const greetingName = user?.first_name || user?.username || 'друг';

  // Closed beta убрана - доступ для всех

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-3">
        <header>
          <h1 className="text-xl font-semibold">VPN</h1>
          <p className="text-slate-400 text-xs mt-0.5">Быстро, без логов, по Telegram Stars.</p>
        </header>

        <TrialBanner />

        {/* Greeting / auth status */}
        <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4">
          {status === 'loading' && (
            <p className="text-slate-400 text-xs">Авторизуемся через Telegram...</p>
          )}
          {status === 'authenticated' && (
            <h2 className="text-base font-semibold">Привет, {greetingName}!</h2>
          )}
          {(status === 'unauthenticated' || status === 'error') && (
            <>
              <h2 className="text-base font-semibold">Нужен Telegram</h2>
              <p className="text-amber-300 text-xs mt-1.5">
                {authError ?? 'Открой приложение из Telegram, чтобы продолжить.'}
              </p>
            </>
          )}
        </section>

        <ActiveSubscriptionCard state={active} />

        {/* QuickActions — компактные тайлы (иконка сверху, подпись снизу). */}
        <section className="grid grid-cols-4 gap-2">
          <QuickAction href="/plans" icon={<CreditCard className="w-5 h-5" />} label="Тарифы" />
          <QuickAction href="/connect" icon={<Globe className="w-5 h-5" />} label="Подключить" />
          <QuickAction href="/devices" icon={<Smartphone className="w-5 h-5" />} label="Устройства" />
          {/* «История» доступна из bottom-nav, на главной её заменяем
              на «Друзья» — реферальная программа с +3 дня за приглашение. */}
          <QuickAction href="/referral" icon={<Users className="w-5 h-5" />} label="Друзья" badge="NEW" />
        </section>

        <footer className="text-slate-500 text-[11px] pt-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          VLESS + Reality · без логов трафика
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function ActiveSubscriptionCard({ state }: { state: ActiveState }) {
  if (state.kind === 'idle' || state.kind === 'loading') {
    return (
      <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 animate-pulse">
        <div className="h-4 w-24 bg-slate-700/60 rounded mb-2" />
        <div className="h-3 w-40 bg-slate-700/60 rounded" />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="rounded-2xl border border-red-500/40 bg-slate-800/50 p-4">
        <h3 className="text-sm font-semibold mb-1">Подписка</h3>
        <p className="text-red-400 text-xs">{state.message}</p>
      </section>
    );
  }

  if (state.kind === 'none') {
    return (
      <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4">
        <h3 className="text-sm font-semibold mb-1">Подписки пока нет</h3>
        <p className="text-slate-400 text-xs mb-3 leading-relaxed">
          Выбери тариф и оплати через Telegram Stars. Ключ появится сразу после оплаты.
        </p>
        <Link
          href="/plans"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/50 hover:border-cyan-400 hover:bg-cyan-400/5 text-cyan-300 text-sm font-medium py-2.5 transition"
        >
          Выбрать тариф
        </Link>
      </section>
    );
  }

  // active
  const { sub } = state;
  const expiresAt = new Date(sub.expires_at);
  const daysLeft = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <section className="rounded-2xl border border-emerald-500/40 bg-slate-800/50 p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{sub.plan_name || 'Подписка'}</h3>
          <p className="text-emerald-400 text-xs flex items-center gap-1.5 mt-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Активна
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold leading-none">{daysLeft}</p>
          <p className="text-slate-400 text-[11px] mt-0.5">дней осталось</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <InfoRow label="Устройств" value={String(sub.max_devices)} />
        <InfoRow label="Истекает" value={expiresAt.toLocaleDateString('ru-RU')} />
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400 text-[11px]">{label}</p>
      <p className="text-slate-100 text-sm">{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  /** Маленький бейдж в углу (напр. "NEW"). */
  badge?: string;
}) {
  // Компактный тайл в стиле bot-menu / iOS app drawer: квадрат с иконкой
  // сверху, подпись под ней. Подходит под grid-cols-4 на mini-app ширине.
  return (
    <Link
      href={href}
      className="relative rounded-2xl border border-slate-700/50 hover:border-slate-600 bg-slate-800/50 px-2 py-3 flex flex-col items-center gap-1.5 transition"
    >
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-400/10 text-cyan-400">
        {icon}
      </span>
      <span className="text-[11px] font-medium text-slate-200 truncate max-w-full">{label}</span>
      {badge && (
        <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-cyan-400 text-slate-900 leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}
