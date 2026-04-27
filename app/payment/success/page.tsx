'use client';

// Лендинг успешной оплаты. WATA/YooMoney редиректят сюда после того,
// как юзер завершил платёж в браузере. Webhook активирует подписку
// независимо, так что эта страница — чисто информационная.
//
// ВАЖНО: внутри Telegram WebView страница может открыться во внешнем
// браузере (webApp.openLink), поэтому js-API Telegram может быть
// недоступен. Сохраняем нейтральный UX без попыток дёрнуть WebApp.

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 text-center border border-green-500/30">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Оплата прошла</h1>
        <p className="text-slate-300 mb-6">
          Подписка активируется в течение пары минут. Можно возвращаться в бота —
          VPN-ссылка появится автоматически.
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 font-semibold transition"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
