'use client';

import type { ComponentType } from 'react';
import { CreditCard, Star, Wallet } from 'lucide-react';
import type { PaymentProvider } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProviderOption {
  id: PaymentProvider;
  label: string;
  sublabel: string;
  icon: ComponentType<{ className?: string }>;
  /** Для «радуги» — тонкий цвет, который отличает провайдеры визуально,
   *  не ломая общий тёмный UI. */
  accent: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'telegram_stars',
    label: 'Telegram Stars',
    sublabel: 'Быстрая оплата в 1 клик',
    icon: Star,
    accent: 'text-amber-400',
  },
  {
    id: 'wata',
    label: 'Карта / СБП',
    sublabel: 'Через WATA • рекомендуем',
    icon: CreditCard,
    accent: 'text-emerald-400',
  },
  {
    id: 'yoomoney',
    label: 'YooMoney',
    sublabel: 'Карта, кошелёк',
    icon: Wallet,
    accent: 'text-violet-400',
  },
];

interface ProviderSelectorProps {
  selected: PaymentProvider;
  /** Список провайдеров, недоступных в текущем контексте (напр. Stars вне TG). */
  disabled?: ReadonlyArray<PaymentProvider>;
  /** Подсказка почему disabled — мапа provider → строка-tooltip. */
  disabledReasons?: Partial<Record<PaymentProvider, string>>;
  onSelect(provider: PaymentProvider): void;
}

export function ProviderSelector({ selected, disabled = [], disabledReasons = {}, onSelect }: ProviderSelectorProps) {
  return (
    <div>
      <p className="text-sm text-slate-400 mb-3">Способ оплаты</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {PROVIDERS.map((p) => {
          const isDisabled = disabled.includes(p.id);
          const isSelected = selected === p.id;
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              disabled={isDisabled}
              title={isDisabled ? disabledReasons[p.id] : undefined}
              onClick={() => onSelect(p.id)}
              aria-pressed={isSelected}
              className={cn(
                'flex items-center sm:flex-col sm:items-start gap-3 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-150 text-left',
                isSelected
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800/70',
                isDisabled && 'opacity-40 cursor-not-allowed hover:bg-slate-800/40',
              )}
            >
              <Icon className={cn('w-6 h-6 shrink-0', p.accent)} />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{p.label}</div>
                <div className="text-xs text-slate-400 truncate">
                  {isDisabled && disabledReasons[p.id] ? disabledReasons[p.id] : p.sublabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
