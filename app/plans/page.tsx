'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { ApiError, vpnApi, type DevicePrice, type PaymentProvider, type SubscriptionPlan } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTelegram } from '@/lib/useTelegram';

type PayState =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'opening' }
  | { kind: 'error'; message: string };

// Склонение "N дней / месяца". duration_days у нас всегда кратно 30 (30/90/180/365),
// но на всякий считаем универсально.
function formatDuration(days: number): string {
  if (days % 365 === 0) {
    const n = days / 365;
    return `${n} ${pluralize(n, ['год', 'года', 'лет'])}`;
  }
  if (days % 30 === 0) {
    const n = days / 30;
    return `${n} ${pluralize(n, ['месяц', 'месяца', 'месяцев'])}`;
  }
  return `${days} ${pluralize(days, ['день', 'дня', 'дней'])}`;
}

// price приходит с backend как "499.00" (fmt "%.2f"). В UI без смысла
// показывать копейки, если они нулевые.
function formatRub(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export default function PlansPage() {
  const { status, error: authError } = useAuth();
  const { hapticFeedback, webApp, showAlert } = useTelegram();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [devicePricing, setDevicePricing] = useState<DevicePrice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<number>(0);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('telegram_stars');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pay, setPay] = useState<PayState>({ kind: 'idle' });

  // Первичная загрузка: /plans публичная, /pricing тоже — JWT не требуется.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const plansData = await vpnApi.listPlans(true);
        if (cancelled) return;
        setPlans(plansData);

        if (plansData.length > 0) {
          setSelectedPlan(plansData[0]);
          const pricing = await vpnApi.getDevicePricing(plansData[0].id);
          if (cancelled) return;
          setDevicePricing(pricing);
          if (pricing.length > 0) setSelectedDevices(pricing[0].max_devices);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlanSelect = async (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    hapticFeedback('light');
    try {
      const pricing = await vpnApi.getDevicePricing(plan.id);
      setDevicePricing(pricing);
      if (pricing.length > 0) setSelectedDevices(pricing[0].max_devices);
    } catch (err) {
      console.error('pricing load failed', err);
    }
  };

  const selectedPrice = useMemo<DevicePrice | null>(() => {
    if (!devicePricing.length) return null;
    return devicePricing.find((p) => p.max_devices === selectedDevices) ?? devicePricing[0];
  }, [devicePricing, selectedDevices]);

  const handlePay = async () => {
    if (!selectedPlan || !selectedPrice) return;

    if (status !== 'authenticated') {
      showAlert(
        status === 'loading'
          ? 'Авторизация ещё в процессе, подожди секунду.'
          : 'Сначала авторизуйся — открой Mini App из Telegram.'
      );
      return;
    }

    // Ранний guard только для Stars — для WATA/YooMoney достаточно openLink
    // (или обычного window.open как fallback вне Telegram).
    if (selectedProvider === 'telegram_stars' && !webApp?.openInvoice) {
      showAlert('Оплата Telegram Stars доступна только внутри Telegram.');
      return;
    }

    try {
      setPay({ kind: 'creating' });
      const invoice = await vpnApi.createInvoice(selectedPlan.id, selectedPrice.max_devices, selectedProvider);
      setPay({ kind: 'opening' });
      hapticFeedback('medium');

      // Для Telegram Stars используем webApp.openInvoice
      if (selectedProvider === 'telegram_stars') {
        if (!webApp?.openInvoice) {
          showAlert('Оплата Telegram Stars доступна только внутри Telegram.');
          setPay({ kind: 'idle' });
          return;
        }

        webApp.openInvoice(invoice.invoice_link, (invStatus) => {
          if (invStatus === 'paid') {
            hapticFeedback('success');
            showAlert('Оплата прошла! Подписка активируется в течение пары секунд.');
            setPay({ kind: 'idle' });
          } else if (invStatus === 'cancelled') {
            setPay({ kind: 'idle' });
          } else if (invStatus === 'failed') {
            hapticFeedback('error');
            setPay({ kind: 'error', message: 'Telegram вернул failed — попробуй ещё раз.' });
          } else {
            setPay({ kind: 'idle' });
          }
        });
      } else {
        // Для YooMoney/ЮKassa открываем в браузере
        if (webApp?.openLink) {
          webApp.openLink(invoice.invoice_link);
        } else {
          window.open(invoice.invoice_link, '_blank');
        }
        setPay({ kind: 'idle' });
        showAlert('Открыта страница оплаты. После оплаты подписка активируется автоматически.');
      }
    } catch (err) {
      hapticFeedback('error');
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось создать инвойс';
      setPay({ kind: 'error', message: msg });
    }
  };

  if (loading) return <FullScreenLoader label="Загрузка тарифов..." />;

  if (loadError) {
    return (
      <ErrorScreen message={loadError}>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 inline-block">
          Назад
        </Link>
      </ErrorScreen>
    );
  }

  const payBusy = pay.kind === 'creating' || pay.kind === 'opening';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/" className="mr-4" aria-label="Назад">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">Выбор тарифа</h1>
        </div>

        {authError && status !== 'authenticated' && (
          <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-200 rounded-lg p-3 mb-4 text-sm">
            {authError}
          </div>
        )}

        <div className="grid gap-4 mb-6">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handlePlanSelect(plan)}
              className={`text-left bg-slate-900 rounded-lg p-6 border-2 transition ${
                selectedPlan?.id === plan.id ? 'border-blue-500' : 'border-slate-800 hover:border-blue-500'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="text-slate-400 text-sm">{formatDuration(plan.duration_days)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatRub(plan.base_price)} ₽</p>
                  <p className="text-slate-400 text-sm">за период</p>
                </div>
              </div>

              <div className="space-y-2">
                <FeatureItem>
                  Базово до {plan.max_devices} {pluralize(plan.max_devices, ['устройства', 'устройств', 'устройств'])}
                </FeatureItem>
                <FeatureItem>Безлимитный трафик</FeatureItem>
                <FeatureItem>Локации: USA, DE, SG, JP</FeatureItem>
              </div>
            </button>
          ))}
        </div>

        {selectedPlan && devicePricing.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Количество устройств</h3>
            <p className="text-slate-400 text-sm mb-4">
              Цена растёт по мере добавления устройств. Выбери сколько нужно одновременно.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {devicePricing.map((price) => (
                <button
                  key={price.max_devices}
                  type="button"
                  onClick={() => {
                    setSelectedDevices(price.max_devices);
                    hapticFeedback('light');
                  }}
                  className={`rounded-lg p-3 text-center transition ${
                    selectedDevices === price.max_devices
                      ? 'bg-blue-600 ring-2 ring-blue-400'
                      : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <p className="text-sm text-slate-300">
                    {price.max_devices} {pluralize(price.max_devices, ['устройство', 'устройства', 'устройств'])}
                  </p>
                  <p className="text-lg font-semibold">{formatRub(price.price)} ₽</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPlan && selectedPrice && (
          <>
            {/* Выбор способа оплаты */}
            <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-400 mb-3">Способ оплаты:</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProvider('telegram_stars');
                    hapticFeedback('light');
                  }}
                  className={`p-3 rounded-lg border-2 transition ${
                    selectedProvider === 'telegram_stars'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  <div className="text-2xl mb-1">⭐</div>
                  <div className="text-sm font-semibold">Telegram Stars</div>
                  <div className="text-xs text-slate-400 mt-1">Быстрая оплата</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProvider('wata');
                    hapticFeedback('light');
                  }}
                  className={`p-3 rounded-lg border-2 transition ${
                    selectedProvider === 'wata'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  <div className="text-2xl mb-1">💳</div>
                  <div className="text-sm font-semibold">Карта / СБП</div>
                  <div className="text-xs text-slate-400 mt-1">Через WATA</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProvider('yoomoney');
                    hapticFeedback('light');
                  }}
                  className={`p-3 rounded-lg border-2 transition ${
                    selectedProvider === 'yoomoney'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  <div className="text-2xl mb-1">🏦</div>
                  <div className="text-sm font-semibold">YooMoney</div>
                  <div className="text-xs text-slate-400 mt-1">Карта, кошелёк</div>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePay}
              disabled={payBusy || status !== 'authenticated'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg py-4 font-semibold text-lg transition flex items-center justify-center gap-2"
            >
              {payBusy && <Loader2 className="w-5 h-5 animate-spin" />}
              {pay.kind === 'creating' && 'Создаём счёт...'}
              {pay.kind === 'opening' && 'Открываем оплату...'}
              {(pay.kind === 'idle' || pay.kind === 'error') && (
                `Оплатить ${formatRub(selectedPrice.price)} ₽`
              )}
            </button>
            {pay.kind === 'error' && (
              <p className="text-red-400 text-sm mt-3 text-center">{pay.message}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center text-sm text-slate-300">
      <Check className="w-4 h-4 mr-2 text-green-400 shrink-0" />
      {children}
    </div>
  );
}

function FullScreenLoader({ label }: { label: string }) {
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
