'use client';

// Pending-страница: открывается после того, как мы проводили юзера во
// внешний браузер для оплаты (WATA/YooMoney). Здесь поллим статус платежа
// и сами переводим на главную (paid) или на /payment/fail (failed).
//
// Если через 5 минут платёж всё ещё pending — показываем «ну, бывает,
// webhook может прийти позже», даём кнопку «На главную». Важно: подписка
// активируется webhook'ом независимо от того, висит юзер на этой странице
// или нет.

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';

import { vpnApi, type Payment } from '@/lib/api';

// Polling constants.
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

type PendingState =
  | { kind: 'waiting'; elapsed: number }
  | { kind: 'paid'; payment: Payment }
  | { kind: 'failed'; payment: Payment }
  | { kind: 'timeout' }
  | { kind: 'error'; message: string };

function PendingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentIdStr = searchParams.get('payment_id');
  const paymentId = paymentIdStr ? Number(paymentIdStr) : NaN;

  // Lazy initializer: если payment_id нет — сразу error, без синхронного
  // setState в useEffect (eslint react-hooks/set-state-in-effect).
  const [state, setState] = useState<PendingState>(() =>
    Number.isFinite(paymentId)
      ? { kind: 'waiting', elapsed: 0 }
      : { kind: 'error', message: 'Не передан payment_id' },
  );

  useEffect(() => {
    if (!Number.isFinite(paymentId)) return;

    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      try {
        const payment = await vpnApi.getPaymentStatus(paymentId);
        if (cancelled) return;
        if (payment?.status === 'paid') {
          setState({ kind: 'paid', payment });
          // Секунда фидбека и уводим на главную.
          setTimeout(() => router.push('/'), 1200);
          return;
        }
        if (payment?.status === 'failed') {
          setState({ kind: 'failed', payment });
          return;
        }

        const elapsed = Date.now() - startedAt;
        if (elapsed >= POLL_TIMEOUT_MS) {
          setState({ kind: 'timeout' });
          return;
        }
        setState({ kind: 'waiting', elapsed });
      } catch (err) {
        // Ошибка listPayments не критична — продолжаем поллить, это может быть
        // короткий сетевой блип. Webhook независимо активирует подписку.
        console.warn('payment poll failed', err);
      }
    }

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [paymentId, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 text-center border border-slate-800">
        {state.kind === 'waiting' && <Waiting elapsed={state.elapsed} />}
        {state.kind === 'paid' && <Paid />}
        {state.kind === 'failed' && <Failed />}
        {state.kind === 'timeout' && <Timeout />}
        {state.kind === 'error' && <ErrorBlock message={state.message} />}
      </div>
    </div>
  );
}

export default function PaymentPendingPage() {
  return (
    // useSearchParams() требует Suspense на страницах Next.js 16.
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      }
    >
      <PendingInner />
    </Suspense>
  );
}

// ── Состояния ──────────────────────────────────────────────────────

function Waiting({ elapsed }: { elapsed: number }) {
  const seconds = Math.floor(elapsed / 1000);
  return (
    <>
      <div className="relative w-16 h-16 mx-auto mb-4">
        <Clock className="w-16 h-16 text-blue-400/30" />
        <Loader2 className="w-16 h-16 text-blue-400 animate-spin absolute inset-0" />
      </div>
      <h1 className="text-xl font-bold mb-2">Ждём подтверждения оплаты</h1>
      <p className="text-slate-400 text-sm mb-4">
        Заверши оплату в открывшейся вкладке. Как только банк подтвердит платёж —
        эта страница сама перейдёт на главную. Подписка активируется автоматически.
      </p>
      <div className="text-xs text-slate-500">прошло {seconds} сек</div>
    </>
  );
}

function Paid() {
  return (
    <>
      <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">Оплата подтверждена</h1>
      <p className="text-slate-300 mb-6">
        Подписка активирована. Переходим на главную…
      </p>
    </>
  );
}

function Failed() {
  return (
    <>
      <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">Оплата не прошла</h1>
      <p className="text-slate-300 mb-6">
        Банк отклонил платёж. Попробуй другую карту или способ оплаты.
      </p>
      <div className="flex gap-3 justify-center">
        <Link
          href="/plans/v2"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2.5 font-semibold transition"
        >
          <RefreshCw className="w-4 h-4" /> Попробовать снова
        </Link>
        <Link
          href="/"
          className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg px-5 py-2.5 font-semibold transition"
        >
          На главную
        </Link>
      </div>
    </>
  );
}

function Timeout() {
  return (
    <>
      <Clock className="w-16 h-16 text-amber-400 mx-auto mb-4" />
      <h1 className="text-xl font-bold mb-2">Проверим чуть позже</h1>
      <p className="text-slate-300 mb-6">
        Пока подтверждение не пришло. Это не страшно — если оплата успешна,
        подписка активируется через webhook за пару минут. Можешь вернуться на главную.
      </p>
      <Link
        href="/"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 font-semibold transition"
      >
        На главную
      </Link>
    </>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <>
      <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
      <h1 className="text-xl font-bold mb-2">Ошибка</h1>
      <p className="text-slate-300 mb-6">{message}</p>
      <Link
        href="/plans/v2"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 font-semibold transition"
      >
        Назад к тарифам
      </Link>
    </>
  );
}
