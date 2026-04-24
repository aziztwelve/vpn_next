'use client';

import type { DevicePrice } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatRub, pluralize, pricePerMonth } from '@/lib/format';

interface DeviceSelectorProps {
  pricing: DevicePrice[];
  selected: number;
  /** Длительность плана в днях — чтобы показывать «/мес» рядом с ценой за N устройств. */
  durationDays: number;
  onSelect(maxDevices: number): void;
}

/** Pill-группа «1 / 2 / 3 устройства». На мобилках — 3 в ряд, на tight screens
 *  автоматически переносится, но обычно 3 пилюли помещаются. */
export function DeviceSelector({ pricing, selected, durationDays, onSelect }: DeviceSelectorProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-semibold">Количество устройств</h3>
        <span className="text-xs text-slate-500">цена/мес</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {pricing.map((p) => {
          const perMonth = pricePerMonth(p.price, durationDays);
          const active = selected === p.max_devices;
          return (
            <button
              key={p.max_devices}
              type="button"
              onClick={() => onSelect(p.max_devices)}
              aria-pressed={active}
              className={cn(
                'rounded-xl px-2 py-3 text-center transition-all duration-150 border',
                'flex flex-col items-center gap-0.5',
                active
                  ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-200',
              )}
            >
              <span className="text-sm font-semibold tabular-nums">{p.max_devices}</span>
              <span className={cn('text-[11px]', active ? 'text-blue-100' : 'text-slate-400')}>
                {pluralize(p.max_devices, ['устр-во', 'устр-ва', 'устр-в'])}
              </span>
              <span className="text-sm font-bold tabular-nums mt-1">
                {formatRub(perMonth)} ₽
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
