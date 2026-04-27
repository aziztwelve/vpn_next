'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Globe, History, Shield, Smartphone } from 'lucide-react';
import { ApiError, vpnApi, type Subscription } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TrialBanner } from '@/components/trial-banner';

// Tokens (синхронно с /connect2):
//   page  — bg-slate-950
//   card  — bg-slate-900 + border-slate-800 (hover:border-slate-700)
//   active state border — border-green-500/40
//   error state border  — border-red-500/40
//   accent — emerald-400 (точки, иконки, outline-кнопки)

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
        <header>
          <h1 className="text-3xl font-bold">VPN</h1>
          <p className="text-slate-400 text-sm mt-1">Быстро, без логов, по Telegram Stars.</p>
        </header>

        <TrialBanner />

        {/* Greeting / auth status */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          {status === 'loading' && (
            <p className="text-slate-400 text-sm">Авторизуемся через Telegram...</p>
          )}
          {status === 'authenticated' && (
            <>
              <h2 className="text-xl font-semibold">Привет, {greetingName}!</h2>
              <p className="text-slate-400 text-sm mt-1">
                Ты в Mini App. Ниже — твоя подписка и устройства.
              </p>
            </>
          )}
          {(status === 'unauthenticated' || status === 'error') && (
            <>
              <h2 className="text-xl font-semibold">Нужен Telegram</h2>
              <p className="text-amber-300 text-sm mt-2">
                {authError ?? 'Открой приложение из Telegram, чтобы продолжить.'}
              </p>
            </>
          )}
        </section>

        <ActiveSubscriptionCard state={active} />

        <section className="grid grid-cols-2 gap-3">
          <QuickAction href="/plans" icon={<CreditCard className="w-5 h-5" />} label="Тарифы" />
          <QuickAction href="/connect" icon={<Globe className="w-5 h-5" />} label="Подключить" />
          <QuickAction href="/connect2" icon={<Globe className="w-5 h-5" />} label="Подключить 2" />
          <QuickAction href="/devices" icon={<Smartphone className="w-5 h-5" />} label="Устройства" />
          <QuickAction href="/history" icon={<History className="w-5 h-5" />} label="История" />
        </section>

        <footer className="text-slate-500 text-xs pt-4 flex items-center gap-2">
          <Shield className="w-4 h-4" />
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
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 animate-pulse">
        <div className="h-5 w-32 bg-slate-800 rounded mb-3" />
        <div className="h-4 w-48 bg-slate-800 rounded" />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="rounded-xl border border-red-500/40 bg-slate-900 p-5">
        <h3 className="font-semibold mb-1">Подписка</h3>
        <p className="text-red-400 text-sm">{state.message}</p>
      </section>
    );
  }

  if (state.kind === 'none') {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold mb-1">Подписки пока нет</h3>
        <p className="text-slate-400 text-sm mb-4 leading-relaxed">
          Выбери тариф и оплати через Telegram Stars. Ключ появится сразу после оплаты.
        </p>
        <Link
          href="/plans"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/50 hover:border-emerald-400 hover:bg-emerald-400/5 text-emerald-300 font-medium py-3 transition"
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
    <section className="rounded-xl border border-green-500/40 bg-slate-900 p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{sub.plan_name || 'Подписка'}</h3>
          <p className="text-emerald-400 text-sm flex items-center gap-1.5 mt-0.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            Активна
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold leading-none">{daysLeft}</p>
          <p className="text-slate-400 text-xs mt-1">дней осталось</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoRow label="Устройств" value={String(sub.max_devices)} />
        <InfoRow label="Истекает" value={expiresAt.toLocaleDateString('ru-RU')} />
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-slate-100">{value}</p>
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
  /** Маленький бейдж справа (напр. "NEW"). */
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900 p-4 flex items-center gap-3 transition"
    >
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-400/10 text-emerald-400 shrink-0">
        {icon}
      </span>
      <span className="font-medium flex-1 truncate">{label}</span>
      {badge && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-400 text-slate-900">
          {badge}
        </span>
      )}
    </Link>
  );
}
