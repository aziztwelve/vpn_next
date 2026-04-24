'use client';

import { Check, Sparkles, TrendingUp } from 'lucide-react';
import type { SubscriptionPlan } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  computeSavings,
  durationMonths,
  formatDuration,
  formatPrice,
  formatRub,
  pluralize,
  pricePerMonth,
} from '@/lib/format';

export type PlanBadge = 'popular' | 'best';

interface PlanCardProps {
  plan: SubscriptionPlan;
  /** Месячный anchor для расчёта «если бы платил помесячно». */
  monthlyAnchor: string | number;
  selected: boolean;
  badge?: PlanBadge | null;
  onSelect(plan: SubscriptionPlan): void;
}

/** Одна карточка тарифа. Главное правило: **одна итоговая цифра** на карточке
 *  (цена за весь период), плюс мелко — цена/мес и экономия.
 *
 *  badge:
 *    - 'popular' → «⭐ Популярно», жёлтая обводка, легкий scale-up
 *    - 'best'    → «−N% / экономия X ₽», зелёный акцент
 */
export function PlanCard({ plan, monthlyAnchor, selected, badge, onSelect }: PlanCardProps) {
  const months = durationMonths(plan.duration_days);
  const perMonth = pricePerMonth(plan.base_price, plan.duration_days);
  const savings = computeSavings(plan.base_price, plan.duration_days, monthlyAnchor);
  const showAnchor = savings.absolute > 0;
  const anchorPrice = Number(monthlyAnchor) * months;

  return (
    <button
      type="button"
      onClick={() => onSelect(plan)}
      aria-pressed={selected}
      className={cn(
        'relative text-left bg-slate-900 rounded-2xl p-5 border-2 transition-all duration-150',
        'flex flex-col gap-3 min-h-[200px]',
        selected
          ? badge === 'popular'
            ? 'border-amber-400 shadow-lg shadow-amber-500/10'
            : 'border-blue-500 shadow-lg shadow-blue-500/10'
          : 'border-slate-800 hover:border-slate-700',
        badge === 'popular' && !selected && 'ring-1 ring-amber-500/30',
      )}
    >
      {badge === 'popular' && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-amber-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-full">
          <Sparkles className="w-3 h-3" />
          ПОПУЛЯРНО
        </span>
      )}
      {badge === 'best' && savings.percent > 0 && (
        <span className="absolute -top-3 right-3 flex items-center gap-1 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          <TrendingUp className="w-3 h-3" />
          −{savings.percent}%
        </span>
      )}

      <div>
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <p className="text-slate-400 text-sm">{formatDuration(plan.duration_days)}</p>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{formatRub(perMonth)}</span>
        <span className="text-slate-400 text-sm">₽/мес</span>
      </div>

      <div className="text-sm text-slate-300 tabular-nums">
        {showAnchor && (
          <span className="text-slate-500 line-through mr-2">{formatPrice(anchorPrice)}</span>
        )}
        <span className="font-medium">{formatPrice(plan.base_price)}</span>
        <span className="text-slate-500"> за {months} {pluralize(months, ['мес', 'мес', 'мес'])}</span>
      </div>

      {savings.absolute > 0 && (
        <p className="text-emerald-400 text-xs">
          Экономия {formatPrice(savings.absolute)} vs помесячно
        </p>
      )}

      <div className="mt-auto flex items-center text-xs text-slate-400">
        <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400 shrink-0" />
        До {plan.max_devices} {pluralize(plan.max_devices, ['устройства', 'устройств', 'устройств'])}
      </div>
    </button>
  );
}
