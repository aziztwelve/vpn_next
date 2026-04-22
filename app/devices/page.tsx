'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { ApiError, vpnApi, type ActiveConnection } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTelegram } from '@/lib/useTelegram';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; connections: ActiveConnection[]; total: number; max: number }
  | { kind: 'error'; message: string };

export default function DevicesPage() {
  const { status, error: authError } = useAuth();
  const { hapticFeedback, showConfirm, showAlert } = useTelegram();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [pendingId, setPendingId] = useState<number | null>(null);

  const load = useCallback(async () => {
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

  useEffect(() => {
    if (status !== 'authenticated') return;
    void load();
  }, [status, load]);

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
      await load();
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

  if (status === 'loading') return <Loader label="Авторизация..." />;
  if (status !== 'authenticated') {
    return (
      <ErrorScreen message={authError ?? 'Нужна авторизация через Telegram.'}>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 inline-block">
          На главную
        </Link>
      </ErrorScreen>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center">
            <Link href="/" className="mr-4" aria-label="Назад">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-bold">Устройства</h1>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-100 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> обновить
          </button>
        </div>

        {state.kind === 'loading' && <Loader label="Загружаем устройства..." inline />}

        {state.kind === 'error' && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-4">
            <p className="text-sm mb-3">{state.message}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2 text-sm"
            >
              Повторить
            </button>
          </div>
        )}

        {state.kind === 'ok' && (
          <>
            <div className="bg-slate-900 rounded-lg p-4 flex justify-between items-center">
              <p className="text-slate-400 text-sm">Активных устройств</p>
              <p className="text-lg font-semibold">
                {state.total} / {state.max}
              </p>
            </div>

            {state.connections.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                Ни одного активного устройства.
                <div className="mt-4">
                  <Link
                    href="/connect"
                    className="inline-block bg-blue-600 hover:bg-blue-700 rounded-lg px-6 py-3 font-semibold transition"
                  >
                    Подключить устройство
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {state.connections.map((c) => (
                  <div
                    key={c.id}
                    className="bg-slate-900 rounded-lg p-4 flex items-center justify-between gap-3 border border-slate-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Smartphone className="w-5 h-5 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.device_identifier}</p>
                        <p className="text-slate-400 text-xs truncate">
                          {c.server_name} · подключено{' '}
                          {new Date(c.connected_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void disconnect(c)}
                      disabled={pendingId === c.id}
                      className="shrink-0 inline-flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-300 rounded-lg px-3 py-2 text-sm transition"
                    >
                      {pendingId === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Отключить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Loader({ label, inline = false }: { label: string; inline?: boolean }) {
  if (inline) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> {label}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-red-400 mb-4">{message}</p>
        {children}
      </div>
    </div>
  );
}
