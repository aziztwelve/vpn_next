'use client';

import { Gift, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/**
 * TrialBanner — показывается только в ПЕРВУЮ загрузку Mini App у нового юзера,
 * когда Gateway вернул `trial_activated: true`. В auth-context это значение
 * хранится в `trialActivation`; после вызова `dismiss()` баннер исчезает.
 *
 * Для старых сессий (trial уже был раньше, юзер возвращается) значение всегда
 * null — баннер не появится.
 */
export function TrialBanner() {
  const { trialActivation } = useAuth();
  if (!trialActivation) return null;

  const { subscription, dismiss } = trialActivation;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  return (
    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-100 flex items-start gap-3">
      <Gift className="w-5 h-5 mt-0.5 text-emerald-400 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-emerald-50">Пробный период активирован</p>
        <p className="mt-1 text-emerald-200/90">
          У тебя {daysLeft} {pluralDays(daysLeft)} бесплатного доступа.
          Подключи устройство — и вперёд.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-emerald-300 hover:text-emerald-100 transition-colors"
        aria-label="Скрыть баннер"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}
