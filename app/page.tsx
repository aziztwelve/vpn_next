'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Globe, History, Shield, Smartphone, Sparkles } from 'lucide-react';
import { ApiError, vpnApi, type Subscription } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TrialBanner } from '@/components/trial-banner';

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
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">VPN</h1>
          <p className="text-slate-400 text-sm mt-1">Быстро, без логов, по Telegram Stars.</p>
        </header>

        <TrialBanner />

        <section className="bg-slate-900 rounded-lg p-6">
          {status === 'loading' && <p className="text-slate-400">Авторизуемся через Telegram...</p>}
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
              <p className="text-yellow-300 text-sm mt-2">
                {authError ?? 'Открой приложение из Telegram, чтобы продолжить.'}
              </p>
            </>
          )}
        </section>

        <section>
          <ActiveSubscriptionCard state={active} />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <QuickAction href="/plans" icon={<CreditCard className="w-5 h-5" />} label="Тарифы" />
          <QuickAction
            href="/plans/v2"
            icon={<Sparkles className="w-5 h-5" />}
            label="Тарифы v2"
            badge="NEW"
            accent="amber"
          />
          <QuickAction href="/connect" icon={<Globe className="w-5 h-5" />} label="Подключить" />
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

function ActiveSubscriptionCard({ state }: { state: ActiveState }) {
  if (state.kind === 'idle' || state.kind === 'loading') {
    return (
      <div className="bg-slate-900 rounded-lg p-6 animate-pulse">
        <div className="h-5 w-32 bg-slate-800 rounded mb-3" />
        <div className="h-4 w-48 bg-slate-800 rounded" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="bg-slate-900 rounded-lg p-6 border border-red-500/40">
        <h3 className="text-lg font-semibold mb-1">Подписка</h3>
        <p className="text-red-400 text-sm">{state.message}</p>
      </div>
    );
  }

  if (state.kind === 'none') {
    return (
      <div className="bg-slate-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-1">Подписки пока нет</h3>
        <p className="text-slate-400 text-sm mb-4">
          Выбери тариф и оплати через Telegram Stars. Ключ появится сразу после оплаты.
        </p>
        <Link
          href="/plans"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold transition"
        >
          Выбрать тариф
        </Link>
      </div>
    );
  }

  // active
  const { sub } = state;
  const expiresAt = new Date(sub.expires_at);
  const daysLeft = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-green-500/40">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold">{sub.plan_name || 'Подписка'}</h3>
          <p className="text-green-400 text-sm">Активна</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{daysLeft}</p>
          <p className="text-slate-400 text-xs">дней осталось</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoRow label="Устройств" value={String(sub.max_devices)} />
        <InfoRow label="Истекает" value={expiresAt.toLocaleDateString('ru-RU')} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-slate-200">{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  badge,
  accent = 'blue',
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  /** Маленький бейдж справа (напр. "NEW"). */
  badge?: string;
  /** Цвет иконки/акцента. */
  accent?: 'blue' | 'amber';
}) {
  const iconColor = accent === 'amber' ? 'text-amber-400' : 'text-blue-400';
  const borderColor =
    accent === 'amber'
      ? 'border-amber-500/40 hover:border-amber-400/60'
      : 'border-slate-800 hover:border-slate-700';
  return (
    <Link
      href={href}
      className={`bg-slate-900 hover:bg-slate-800 rounded-lg p-4 flex items-center gap-3 transition border ${borderColor}`}
    >
      <span className={iconColor}>{icon}</span>
      <span className="font-medium flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-900">
          {badge}
        </span>
      )}
    </Link>
  );
}
