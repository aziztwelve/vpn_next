'use client';

// Лендинг неуспешной оплаты. WATA/YooMoney редиректят сюда, если
// клиент закрыл форму, банк отклонил платёж или истёк срок действия
// платёжной ссылки. Webhook НЕ активирует подписку, т.к. статус Declined.

import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function PaymentFailPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 text-center border border-red-500/30">
        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Оплата не прошла</h1>
        <p className="text-slate-300 mb-6">
          Деньги не списаны. Можно попробовать ещё раз — выбрать другой способ оплаты
          или другую карту.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/plans"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 font-semibold transition"
          >
            Вернуться к тарифам
          </Link>
          <Link
            href="/"
            className="inline-block text-slate-400 hover:text-slate-200 text-sm"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
