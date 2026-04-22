'use client';

import { useEffect, useState } from 'react';
import { vpnApi, Subscription } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function HistoryPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await vpnApi.getSubscriptionHistory();
        setSubscriptions(history);
        setLoading(false);
      } catch (err) {
        console.error('Ошибка загрузки истории:', err);
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Загрузка истории...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 inline-block">
            Назад
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/" className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">История подписок</h1>
        </div>

        {subscriptions.length > 0 ? (
          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className={`bg-slate-900 rounded-lg p-6 border-2 ${
                  sub.is_active ? 'border-green-500' : 'border-slate-800'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Подписка #{sub.id}</h3>
                    <p className="text-slate-400 text-sm">До {sub.max_devices} устройств</p>
                  </div>
                  <div>
                    {sub.is_active ? (
                      <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-semibold">
                        Активна
                      </span>
                    ) : (
                      <span className="bg-slate-700 text-slate-400 px-3 py-1 rounded-full text-sm">
                        Истекла
                      </span>
                    )}
                  </div>
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

                {sub.auto_renew && sub.is_active && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <p className="text-sm text-blue-400">
                      ✓ Автопродление включено
                    </p>
                  </div>
                )}
              </div>
            ))}
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
