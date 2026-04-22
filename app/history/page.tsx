'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ApiError, vpnApi, type Subscription } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// Подписка "живая" — её можно отменить, трафик ходит. Всё остальное — история.
function isCurrent(sub: Subscription): boolean {
  if (sub.status !== 'active') return false;
  const expires = Date.parse(sub.expires_at);
  return !Number.isFinite(expires) || expires > Date.now();
}

function statusBadge(sub: Subscription): { label: string; className: string } {
  if (isCurrent(sub)) {
    return {
      label: 'Активна',
      className: 'bg-green-500/20 text-green-400',
    };
  }
  switch (sub.status) {
    case 'cancelled':
      return { label: 'Отменена', className: 'bg-orange-500/20 text-orange-300' };
    case 'expired':
      return { label: 'Истекла', className: 'bg-slate-700 text-slate-400' };
    default:
      return { label: sub.status, className: 'bg-slate-700 text-slate-400' };
  }
}

export default function HistoryPage() {
  const { status: authStatus, error: authError } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;

    (async () => {
      try {
        const history = await vpnApi.getSubscriptionHistory();
        if (!cancelled) setSubscriptions(history ?? []);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof ApiError
              ? `${err.status}: ${err.message}`
              : err instanceof Error
                ? err.message
                : 'Ошибка загрузки';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  if (authStatus === 'loading') {
    return <Loader label="Авторизация..." />;
  }

  if (authStatus !== 'authenticated') {
    return (
      <ErrorScreen message={authError ?? 'Нужна авторизация через Telegram.'}>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 inline-block">
          На главную
        </Link>
      </ErrorScreen>
    );
  }

  if (loading) return <Loader label="Загрузка истории..." />;

  if (error) {
    return (
      <ErrorScreen message={error}>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 inline-block">
          Назад
        </Link>
      </ErrorScreen>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/" className="mr-4" aria-label="Назад">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">История подписок</h1>
        </div>

        {subscriptions.length > 0 ? (
          <div className="space-y-4">
            {subscriptions.map((sub) => {
              const current = isCurrent(sub);
              const badge = statusBadge(sub);
              return (
                <div
                  key={sub.id}
                  className={`bg-slate-900 rounded-lg p-6 border-2 ${
                    current ? 'border-green-500' : 'border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">{sub.plan_name || `Подписка #${sub.id}`}</h3>
                      <p className="text-slate-400 text-sm">
                        До {sub.max_devices} устройств · {sub.total_price} ₽
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Начало</p>
                      <p className="text-slate-200">
                        {new Date(sub.started_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Окончание</p>
                      <p className="text-slate-200">
                        {new Date(sub.expires_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">История подписок пуста</p>
            <Link
              href="/plans"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 font-semibold transition"
            >
              Выбрать тариф
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Loader({ label }: { label: string }) {
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
