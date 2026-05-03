'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { ApiError, vpnApi, type ActiveConnection } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTelegram } from '@/lib/useTelegram';

// Дизайн страницы синхронен с главной (app/page.tsx):
//   page    — bg-slate-950
//   card    — bg-slate-800/50 + border-slate-700/50
//   радиус  — rounded-2xl
//   max-w   — max-w-2xl, px-4 pt-5 space-y-4, pb-24 для bottom-nav
//   акценты — cyan-400 (primary), red-300 для disconnect.

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; connections: ActiveConnection[]; total: number; max: number }
  | { kind: 'error'; message: string };

export default function DevicesPage() {
  const { status, error: authError } = useAuth();
  const { hapticFeedback, showConfirm, showAlert } = useTelegram();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [pendingId, setPendingId] = useState<number | null>(null);

  // reload — пользовательский ре-фетч (кнопка "обновить" / после disconnect).
  // Здесь МОЖНО дёргать setState upfront — вызывается из event handler'а,
  // правило react-hooks/set-state-in-effect не применяется.
  const reload = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const data = await vpnApi.getActiveConnections();
      setState({
        kind: 'ok',
        connections: data.connections ?? [],
        total: data.total_connections ?? 0,
        max: data.max_devices ?? 0,
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось загрузить устройства';
      setState({ kind: 'error', message: msg });
    }
  }, []);

  // Первичная загрузка. Логика инлайнится внутрь useEffect (а не зовётся
  // через reload), чтобы линтер react-hooks/set-state-in-effect не считал
  // setState({kind:'loading'}) синхронным setState в эффекте. Initial state
  // уже kind:'loading', все остальные setState'ы — после await.
  // cancelled-флаг защищает от race при unmount/ре-ран.
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const data = await vpnApi.getActiveConnections();
        if (cancelled) return;
        setState({
          kind: 'ok',
          connections: data.connections ?? [],
          total: data.total_connections ?? 0,
          max: data.max_devices ?? 0,
        });
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Не удалось загрузить устройства';
        setState({ kind: 'error', message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const disconnect = async (conn: ActiveConnection) => {
    // Если есть TG confirm — используем его, иначе нативный confirm.
    const confirmed: boolean = await new Promise((resolve) => {
      const msg = `Отключить «${conn.device_identifier}»?\nСлот освободится сразу.`;
      if (showConfirm) {
        showConfirm(msg, (ok) => resolve(!!ok));
      } else if (typeof window !== 'undefined') {
        resolve(window.confirm(msg));
      } else {
        resolve(false);
      }
    });

    if (!confirmed) return;

    setPendingId(conn.id);
    try {
      await vpnApi.disconnectDevice(conn.id);
      hapticFeedback('success');
      await reload();
    } catch (err) {
      hapticFeedback('error');
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось отключить';
      showAlert(msg);
    } finally {
      setPendingId(null);
    }
  };

  if (status === 'loading') return <FullPageLoader label="Авторизация..." />;
  if (status !== 'authenticated') {
    return (
      <FullPageError message={authError ?? 'Нужна авторизация через Telegram.'} />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <Link href="/" aria-label="Назад" className="p-1 -ml-1 shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">Устройства</h1>
              <p className="text-slate-400 text-xs mt-0.5">Активные подключения</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={state.kind === 'loading'}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-700/50 hover:border-slate-600 bg-slate-800/50 hover:bg-slate-800/70 text-slate-300 hover:text-slate-100 disabled:opacity-60 px-3 py-2 text-xs transition"
            aria-label="Обновить"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${state.kind === 'loading' ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </header>

        {state.kind === 'loading' && (
          <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 animate-pulse">
            <div className="h-4 w-24 bg-slate-700/60 rounded mb-2" />
            <div className="h-3 w-40 bg-slate-700/60 rounded" />
          </section>
        )}

        {state.kind === 'error' && (
          <section className="rounded-2xl border border-red-500/40 bg-slate-800/50 p-4">
            <h3 className="text-sm font-semibold mb-1">Ошибка</h3>
            <p className="text-red-400 text-xs mb-3">{state.message}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-medium px-4 py-2 transition"
            >
              Повторить
            </button>
          </section>
        )}

        {state.kind === 'ok' && (
          <>
            <SlotsCounter total={state.total} max={state.max} />

            {state.connections.length === 0 ? (
              <EmptyDevicesCard />
            ) : (
              <section className="space-y-3">
                {state.connections.map((c) => (
                  <DeviceRow
                    key={c.id}
                    conn={c}
                    pending={pendingId === c.id}
                    onDisconnect={() => void disconnect(c)}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SlotsCounter — компактный индикатор «X из Y слотов занято»,
// в цвет emerald (если есть свободные) или amber (если все заняты).
// ─────────────────────────────────────────────────────────────
function SlotsCounter({ total, max }: { total: number; max: number }) {
  const allBusy = max > 0 && total >= max;
  const accent = allBusy
    ? 'border-amber-500/40 from-amber-500/10 text-amber-200'
    : 'border-emerald-500/40 from-emerald-500/10 text-emerald-200';
  return (
    <section
      className={`rounded-2xl border bg-gradient-to-br to-slate-800/50 p-4 flex items-center justify-between ${accent}`}
    >
      <div>
        <p className="text-[10px] uppercase tracking-wider opacity-80">Активных устройств</p>
        <p className="text-2xl font-bold leading-none mt-1">
          {total} <span className="text-slate-400 text-base font-normal">/ {max || '—'}</span>
        </p>
      </div>
      <Smartphone className={`w-6 h-6 ${allBusy ? 'text-amber-300' : 'text-emerald-300'}`} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// EmptyDevicesCard — gradient карточка по образцу «Подписки пока нет»
// с главной. CTA ведёт на /connect.
// ─────────────────────────────────────────────────────────────
function EmptyDevicesCard() {
  return (
    <section className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/70 to-slate-900/50 p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="rounded-xl bg-cyan-400/10 p-2.5 shrink-0">
          <Smartphone className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold">Пока нет устройств</h3>
          <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
            Подключи приложение через ссылку — устройство появится тут после
            первого fetch&apos;а подписки.
          </p>
        </div>
      </div>
      <Link
        href="/connect"
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 text-slate-900 text-sm font-semibold py-3 transition"
      >
        Подключить устройство
        <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// DeviceRow — карточка одного устройства. Совместима с двумя моделями:
//   - server_name пустой: запись из subscription-touch'а (server_id=NULL).
//     Показываем «через подписку» как replacement.
//   - server_name есть: legacy GetVLESSLink-flow, показываем имя сервера.
// Кнопка «Отключить» — красная, в стиле остального UI.
// ─────────────────────────────────────────────────────────────
function DeviceRow({
  conn,
  pending,
  onDisconnect,
}: {
  conn: ActiveConnection;
  pending: boolean;
  onDisconnect: () => void;
}) {
  const connectedAt = new Date(conn.connected_at).toLocaleDateString('ru-RU');
  // server_name пусто для subscription-touch — ставим заглушку.
  const sourceLabel = conn.server_name || 'через подписку';

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 flex items-center gap-3">
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-400/10 text-cyan-400 shrink-0">
        <Smartphone className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{conn.device_identifier}</p>
        <p className="text-slate-400 text-[11px] truncate mt-0.5">
          {sourceLabel} · подключено {connectedAt}
        </p>
      </div>
      <button
        type="button"
        onClick={onDisconnect}
        disabled={pending}
        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-300 px-3 py-2 text-xs font-medium transition"
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Отключить
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Полноэкранные fallback-screen'ы для unauth/loading состояний.
// ─────────────────────────────────────────────────────────────
function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin h-10 w-10 text-cyan-400 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">{label}</p>
      </div>
    </div>
  );
}

function FullPageError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-red-400 mb-4 text-sm">{message}</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-900 text-sm font-semibold px-6 py-3 transition"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
