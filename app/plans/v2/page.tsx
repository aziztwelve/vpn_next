'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Gift, Loader2, ShieldCheck } from 'lucide-react';

import {
  ApiError,
  vpnApi,
  type DevicePrice,
  type PaymentProvider,
  type Subscription,
  type SubscriptionPlan,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTelegram } from '@/lib/useTelegram';
import { computeSavings, formatPrice, formatShortDate, pluralize } from '@/lib/format';

import { PlanCard, type PlanBadge } from '@/components/plans/PlanCard';
import { DeviceSelector } from '@/components/plans/DeviceSelector';
import { ProviderSelector } from '@/components/plans/ProviderSelector';
import { PlanSkeleton } from '@/components/plans/PlanSkeleton';
import { CompareTable } from '@/components/plans/CompareTable';

// ── State machine оплаты ──────────────────────────────────────────────
type PayState =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'opening' }
  | { kind: 'error'; message: string };

// ── LocalStorage ключи ────────────────────────────────────────────────
// TODO(plans-v2): вернуть LS_PROMO и LS_AUTO_RENEW при подключении бизнес-фич
// (см. docs/tasks/09-plans-v2.md, разделы Промокоды и Автопродление).
const LS_PROVIDER = 'vpn_provider';
const LS_DEVICES = 'vpn_last_devices';

// Безопасные helpers для LS (SSR-guard + try/catch на случай приватного режима).
function readLS(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

/** Начальное значение провайдера: восстанавливаем из LS, с fallback на wata,
 *  если Stars недоступен в этой среде (открыто в web вне Telegram). */
function resolveInitialProvider(): PaymentProvider {
  const saved = readLS(LS_PROVIDER);
  if (saved === 'wata' || saved === 'yoomoney') return saved;
  if (typeof window !== 'undefined') {
    const starsAvailable =
      typeof (window as { Telegram?: { WebApp?: { openInvoice?: unknown } } }).Telegram?.WebApp
        ?.openInvoice === 'function';
    if (saved === 'telegram_stars' && starsAvailable) return 'telegram_stars';
    return starsAvailable ? 'telegram_stars' : 'wata';
  }
  return 'telegram_stars';
}

export default function PlansV2Page() {
  const router = useRouter();
  const { status, error: authError } = useAuth();
  const { hapticFeedback, webApp, showAlert } = useTelegram();
  const canUseStars = !!webApp?.openInvoice;

  // ── Данные ──────────────────────────────────────────────────────────
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [pricingByPlan, setPricingByPlan] = useState<Map<number, DevicePrice[]>>(new Map());
  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Выбор юзера ─────────────────────────────────────────────────────
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<number>(0);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>(() =>
    resolveInitialProvider(),
  );
  const [pay, setPay] = useState<PayState>({ kind: 'idle' });

  // ── Первичная загрузка: параллельно планы + prefetch всех pricing ──
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const plansData = await vpnApi.listPlans(true);
        if (cancelled) return;
        // Сортируем по длительности — чтобы независимо от порядка в БД
        // слева был самый короткий, справа — самый длинный.
        const sorted = [...plansData].sort((a, b) => a.duration_days - b.duration_days);
        setPlans(sorted);

        if (sorted.length === 0) {
          setLoading(false);
          return;
        }

        // Prefetch всех pricing'ов параллельно — клик по плану теперь мгновенный.
        const pricings = await Promise.all(
          sorted.map((p) => vpnApi.getDevicePricing(p.id).catch(() => [] as DevicePrice[])),
        );
        if (cancelled) return;
        const map = new Map<number, DevicePrice[]>();
        sorted.forEach((p, i) => map.set(p.id, pricings[i]));
        setPricingByPlan(map);

        // Выбор по умолчанию: средний план (самый «популярный»), иначе первый.
        const defaultPlan = sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
        setSelectedPlanId(defaultPlan.id);

        // Устройства — пытаемся вспомнить из localStorage, иначе 1.
        const rememberedDev = Number(readLS(LS_DEVICES));
        const devicePricing = map.get(defaultPlan.id) ?? [];
        const found = devicePricing.find((d) => d.max_devices === rememberedDev);
        setSelectedDevices(found?.max_devices ?? devicePricing[0]?.max_devices ?? 1);

        // Активная подписка — чтобы показать trial-бэйдж или "продление".
        try {
          const { subscription } = await vpnApi.getActiveSubscription();
          if (!cancelled) setActiveSub(subscription);
        } catch {
          // /subscriptions/active требует JWT. Если юзер не авторизован — просто пропускаем.
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки тарифов');
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

  // Если Stars вдруг стали недоступны (юзер открыл страницу вне Telegram, а
  // в LS было 'telegram_stars') — переключаем провайдера через async-style
  // (setState в Promise callback, чтобы не нарушить react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!canUseStars && selectedProvider === 'telegram_stars') {
      Promise.resolve().then(() => setSelectedProvider('wata'));
    }
  }, [canUseStars, selectedProvider]);

  // ── Производные значения ──────────────────────────────────────────
  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const devicePricing = useMemo<DevicePrice[]>(
    () => (selectedPlanId ? pricingByPlan.get(selectedPlanId) ?? [] : []),
    [pricingByPlan, selectedPlanId],
  );

  const selectedPrice = useMemo<DevicePrice | null>(() => {
    if (!devicePricing.length) return null;
    return devicePricing.find((p) => p.max_devices === selectedDevices) ?? devicePricing[0];
  }, [devicePricing, selectedDevices]);

  // monthlyAnchor = цена самого короткого плана (для 1 устройства) — нужен
  // для расчёта «если бы платил помесячно» → экономия и −N%.
  const monthlyAnchor = useMemo(() => {
    const monthlyPlan = plans.find((p) => p.duration_days === 30) ?? plans[0];
    return monthlyPlan?.base_price ?? '0';
  }, [plans]);

  // Badges: popular → средний план, best → самый длинный (если экономия > 0).
  const badges = useMemo<Map<number, PlanBadge>>(() => {
    if (plans.length < 2) return new Map();
    const m = new Map<number, PlanBadge>();
    const mid = plans[Math.floor(plans.length / 2)];
    const last = plans[plans.length - 1];
    if (mid) m.set(mid.id, 'popular');
    if (last && last.id !== mid?.id) {
      const s = computeSavings(last.base_price, last.duration_days, monthlyAnchor);
      if (s.percent > 0) m.set(last.id, 'best');
    }
    return m;
  }, [plans, monthlyAnchor]);

  const starsDisabledReason = !canUseStars ? 'Доступно только внутри Telegram' : undefined;

  // ── Итоговая цена ─────────────────────────────────────────────────
  const total = selectedPrice ? Number(selectedPrice.price) : 0;

  // ── Handlers ──────────────────────────────────────────────────────
  const handlePlanSelect = useCallback(
    (plan: SubscriptionPlan) => {
      setSelectedPlanId(plan.id);
      hapticFeedback('light');
      // Переносим прошлый выбор устройств, если новый план его поддерживает.
      const newPricing = pricingByPlan.get(plan.id) ?? [];
      const supported = newPricing.find((d) => d.max_devices === selectedDevices);
      if (!supported && newPricing.length) setSelectedDevices(newPricing[0].max_devices);
    },
    [hapticFeedback, pricingByPlan, selectedDevices],
  );

  const handleDevices = useCallback(
    (n: number) => {
      setSelectedDevices(n);
      hapticFeedback('light');
      writeLS(LS_DEVICES, String(n));
    },
    [hapticFeedback],
  );

  const handleProvider = useCallback(
    (p: PaymentProvider) => {
      setSelectedProvider(p);
      hapticFeedback('light');
      writeLS(LS_PROVIDER, p);
    },
    [hapticFeedback],
  );

  const handlePay = async () => {
    if (!selectedPlan || !selectedPrice) return;
    if (status !== 'authenticated') {
      showAlert(
        status === 'loading'
          ? 'Авторизация ещё в процессе, подожди секунду.'
          : 'Сначала авторизуйся — открой Mini App из Telegram.',
      );
      return;
    }
    if (selectedProvider === 'telegram_stars' && !canUseStars) {
      showAlert('Оплата Telegram Stars доступна только внутри Telegram.');
      return;
    }

    try {
      setPay({ kind: 'creating' });
      const invoice = await vpnApi.createInvoice(
        selectedPlan.id,
        selectedPrice.max_devices,
        selectedProvider,
      );
      setPay({ kind: 'opening' });
      hapticFeedback('medium');

      if (selectedProvider === 'telegram_stars') {
        webApp!.openInvoice!(invoice.invoice_link, (invStatus) => {
          if (invStatus === 'paid') {
            hapticFeedback('success');
            setPay({ kind: 'idle' });
            router.push('/');
          } else if (invStatus === 'failed') {
            hapticFeedback('error');
            setPay({ kind: 'error', message: 'Telegram вернул failed — попробуй ещё раз.' });
          } else {
            setPay({ kind: 'idle' });
          }
        });
      } else {
        // WATA / YooMoney — внешняя страница. Сразу уводим юзера на /payment/pending,
        // который сам поллит статус и редиректит на / при paid.
        if (webApp?.openLink) webApp.openLink(invoice.invoice_link);
        else window.open(invoice.invoice_link, '_blank');
        setPay({ kind: 'idle' });
        router.push(`/payment/pending?payment_id=${invoice.payment_id}`);
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

  const payBusy = pay.kind === 'creating' || pay.kind === 'opening';

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 sm:px-6 pt-4 pb-10">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* header */}
        <div className="flex items-center">
          <Link href="/" className="mr-3 p-1 -ml-1 rounded hover:bg-slate-800 transition" aria-label="Назад">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold">Выбор тарифа</h1>
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold uppercase tracking-wide">
            v2
          </span>
        </div>

        {authError && status !== 'authenticated' && (
          <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-200 rounded-lg p-3 text-sm">
            {authError}
          </div>
        )}

        {/* trial banner — показываем, если у юзера активен trial */}
        {activeSub && activeSub.status === 'trial' && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-100">
            <Gift className="w-5 h-5 mt-0.5 shrink-0 text-emerald-400" />
            <div className="text-sm">
              <p className="font-semibold">Активен пробный период до {formatShortDate(activeSub.expires_at)}</p>
              <p className="text-emerald-200/80">
                Продли заранее — доступ не прервётся, оплата в любой момент.
              </p>
            </div>
          </div>
        )}

        {loading && <PlanSkeleton />}
        {loadError && !loading && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/40 text-red-200 p-4 text-sm">
            {loadError}
          </div>
        )}

        {!loading && !loadError && plans.length > 0 && (
          <>
            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  monthlyAnchor={monthlyAnchor}
                  selected={selectedPlanId === plan.id}
                  badge={badges.get(plan.id) ?? null}
                  onSelect={handlePlanSelect}
                />
              ))}
            </div>

            <CompareTable plans={plans} selectedId={selectedPlanId} monthlyAnchor={monthlyAnchor} />

            {/* Devices */}
            {selectedPlan && devicePricing.length > 0 && (
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                <DeviceSelector
                  pricing={devicePricing}
                  selected={selectedDevices}
                  durationDays={selectedPlan.duration_days}
                  onSelect={handleDevices}
                />
              </div>
            )}

            {/* TODO(plans-v2): Промокод — UI скрыт до появления бэкенд-ручки
                POST /payments/promo/validate. См. docs/tasks/09-plans-v2.md */}

            {/* Provider */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
              <ProviderSelector
                selected={selectedProvider}
                disabled={!canUseStars ? ['telegram_stars'] : []}
                disabledReasons={
                  !canUseStars ? { telegram_stars: starsDisabledReason! } : undefined
                }
                onSelect={handleProvider}
              />
            </div>

            {/* TODO(plans-v2): Автопродление — UI скрыт до появления recurring-
                flow через WATA + cron-воркера. См. docs/tasks/09-plans-v2.md */}

            {/* Total + Pay — компактный вариант (~75% от исходной высоты) */}
            {selectedPlan && selectedPrice && (
              <div className="bg-slate-900 rounded-xl px-4 py-3 border border-slate-800 space-y-2.5 sticky bottom-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-xs text-slate-400">Итого к оплате</div>
                  <div className="text-right tabular-nums">
                    <div className="text-lg font-bold leading-none">{formatPrice(total)}</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 leading-tight">
                  {selectedPlan.name}, {selectedPrice.max_devices}{' '}
                  {pluralize(selectedPrice.max_devices, ['устройство', 'устройства', 'устройств'])}
                </div>

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={payBusy || status !== 'authenticated'}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg py-2.5 font-semibold text-base transition flex items-center justify-center gap-2 shadow shadow-blue-500/20"
                >
                  {payBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pay.kind === 'creating' && 'Создаём счёт…'}
                  {pay.kind === 'opening' && 'Открываем оплату…'}
                  {(pay.kind === 'idle' || pay.kind === 'error') &&
                    `Оплатить ${formatPrice(total)}`}
                </button>

                {pay.kind === 'error' && (
                  <p className="text-red-400 text-xs text-center">{pay.message}</p>
                )}

                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                  <ShieldCheck className="w-3 h-3" />
                  Безопасная оплата · подписка активируется автоматически
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
