'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CreditCard,
  Globe,
  History,
  Megaphone,
  Shield,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { ApiError, vpnApi, type Subscription } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TrialBanner } from '@/components/trial-banner';

// Tokens (синхронно с /connect):
//   page    — bg-slate-950
//   card    — bg-slate-800/50 + border-slate-700/50 (hover:border-slate-600)
//   accent  — cyan-400 (основной), emerald-400 (активная подписка), violet-400 (реферал)
//   error   — border-red-500/40
//   radius  — rounded-2xl

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

  const greetingName = user?.first_name || user?.username || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        {/* ── Header + greeting в одном блоке ───────────────────────── */}
        <header>
          <h1 className="text-xl font-semibold">
            {status === 'authenticated' && greetingName
              ? <>Привет, {greetingName} <span className="inline-block">👋</span></>
              : 'MaydaVPN'}
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            {status === 'authenticated'
              ? 'Быстро, безопасно, без логов — от айтишников'
              : 'Telegram Mini App для приватного интернета'}
          </p>
        </header>

        <TrialBanner />

        {/* ── Auth ошибка / unauthenticated ───────────────────────── */}
        {(status === 'unauthenticated' || status === 'error') && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
            <h3 className="text-sm font-semibold mb-1 text-amber-200">Нужен Telegram</h3>
            <p className="text-amber-300/90 text-xs">
              {authError ?? 'Открой приложение из Telegram, чтобы продолжить.'}
            </p>
          </section>
        )}

        {/* ── Активная подписка / нет подписки ─────────────────────── */}
        <ActiveSubscriptionCard state={active} />

        {/* ── Главные действия: Тарифы + Подключение ───────────────── */}
        <section className="grid grid-cols-2 gap-3">
          <BigActionCard
            href="/plans"
            icon={<CreditCard className="w-6 h-6" />}
            title="Тарифы"
            subtitle="Купить подписку"
            tone="cyan"
          />
          <BigActionCard
            href="/connect"
            icon={<Globe className="w-6 h-6" />}
            title="Подключение"
            subtitle="Получить ключ"
            tone="emerald"
          />
        </section>

        {/* ── Реферальный баннер ─────────────────────────────────── */}
        <ReferralBanner />

        {/* ── Вспомогательные мелкие линки ─────────────────────── */}
        <section className="grid grid-cols-2 gap-2">
          <SmallLink href="/devices" icon={<Smartphone className="w-4 h-4" />} label="Устройства" />
          <SmallLink href="/history" icon={<History className="w-4 h-4" />} label="История" />
        </section>

        {/* ── Admin-only: разделитель + блок управления ────────────
            Видно только при user.role === 'admin'. Обычные юзеры даже
            не узнают, что такой раздел существует. Новые админские
            ручки просто пушатся в <AdminLink /> ниже. */}
        {user?.role === 'admin' && (
          <section className="pt-2 space-y-2">
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Только для админа
              </span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>
            <AdminLink
              href="/admin/campaigns"
              icon={<Megaphone className="w-4 h-4" />}
              label="Воронки"
            />
          </section>
        )}

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
      <section className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/70 to-slate-900/50 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="rounded-xl bg-cyan-400/10 p-2.5 shrink-0">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">Подписки пока нет</h3>
            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
              Выбери тариф — получишь ключ сразу после оплаты.
            </p>
          </div>
        </div>
        <Link
          href="/plans"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 text-slate-900 text-sm font-semibold py-3 transition"
        >
          Выбрать тариф
          <ArrowRight className="w-4 h-4" />
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
  // Прогресс-бар: считаем по 30/90/180/365 — чтобы было «осталось X% от срока».
  // Без started_at точно не знаем, поэтому приближаем по типу плана.
  // В идеале backend отдаёт started_at — пока без него, оставляем простой бар.

  return (
    <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-slate-800/50 p-5">
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 text-[11px] uppercase tracking-wider font-semibold">
              Активна
            </span>
          </div>
          <h3 className="text-base font-semibold truncate">
            {sub.plan_name || 'Подписка'}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold leading-none text-emerald-300">{daysLeft}</p>
          <p className="text-slate-400 text-[10px] mt-1 uppercase tracking-wider">
            дн. осталось
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-emerald-500/20">
        <InfoRow label="Устройств" value={String(sub.max_devices)} />
        <InfoRow label="Истекает" value={expiresAt.toLocaleDateString('ru-RU')} />
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-slate-100 text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BigActionCard — большая карточка с иконкой, заголовком и подписью.
// Используется для двух главных действий (Тарифы / Подключение).
// ─────────────────────────────────────────────────────────────
function BigActionCard({
  href,
  icon,
  title,
  subtitle,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** Цвет иконки/акцента. Бордер всегда нейтральный, чтобы карточки не «кричали». */
  tone: 'cyan' | 'emerald';
}) {
  const toneClasses = tone === 'cyan'
    ? 'bg-cyan-400/10 text-cyan-400 group-hover:bg-cyan-400/15'
    : 'bg-emerald-400/10 text-emerald-400 group-hover:bg-emerald-400/15';

  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-700/50 hover:border-slate-600 bg-slate-800/50 hover:bg-slate-800/70 p-4 flex flex-col gap-3 transition-all"
    >
      <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${toneClasses}`}>
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-slate-400 text-[11px] mt-0.5">{subtitle}</p>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// ReferralBanner — акцентный баннер реферальной программы.
// Привлекает внимание (полноширинный, с градиентом), но не агрессивен.
// ─────────────────────────────────────────────────────────────
function ReferralBanner() {
  return (
    <Link
      href="/referral"
      className="block rounded-2xl border border-violet-500/40 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-violet-500/15 hover:from-violet-500/20 hover:to-violet-500/20 p-4 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-400/15 p-2.5 shrink-0">
          <Users className="w-5 h-5 text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Пригласи друга</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-400 text-slate-900 leading-none">
              NEW
            </span>
          </div>
          <p className="text-violet-200/80 text-[11px] mt-0.5">
            +3 дня обоим · 30% с оплат для партнёров
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-violet-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// SmallLink — мелкая ссылка для второстепенных разделов
// (Устройства / История). Inline-стиль, чтобы не отвлекать.
// ─────────────────────────────────────────────────────────────
function SmallLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-800/60 px-3 py-2.5 text-xs text-slate-300 hover:text-slate-100 transition"
    >
      {icon}
      {label}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// AdminLink — полноширинная строка для admin-only разделов.
// Тон нейтрально-янтарный, чтобы визуально отделить от юзерских
// SmallLink'ов выше, но без «ALERT»-вау-эффекта.
// ─────────────────────────────────────────────────────────────
function AdminLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 px-4 py-3 text-sm text-amber-200 hover:text-amber-100 transition"
    >
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-400/15 text-amber-300 shrink-0">
        {icon}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      <ArrowRight className="w-4 h-4 text-amber-400/60 group-hover:translate-x-0.5 group-hover:text-amber-300 transition" />
    </Link>
  );
}
