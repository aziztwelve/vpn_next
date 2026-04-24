'use client';

import type { SubscriptionPlan } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  computeSavings,
  durationMonths,
  formatPrice,
  formatRub,
  pluralize,
  pricePerMonth,
} from '@/lib/format';

interface CompareTableProps {
  plans: SubscriptionPlan[];
  selectedId: number | null;
  monthlyAnchor: string | number;
}

/** Таблица-сравнение тарифов для широких экранов (sm+).
 *  На мобилке скрывается — карточки делают ту же работу. */
export function CompareTable({ plans, selectedId, monthlyAnchor }: CompareTableProps) {
  if (plans.length < 2) return null;
  return (
    <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full text-sm tabular-nums">
        <thead className="bg-slate-900/60 text-slate-400">
          <tr>
            <th className="text-left font-normal px-4 py-3">Что</th>
            {plans.map((p) => (
              <th
                key={p.id}
                className={cn(
                  'text-left font-semibold px-4 py-3',
                  selectedId === p.id && 'text-blue-300',
                )}
              >
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          <Row label="Цена / мес">
            {plans.map((p) => (
              <td key={p.id} className="px-4 py-2">
                {formatRub(pricePerMonth(p.base_price, p.duration_days))} ₽
              </td>
            ))}
          </Row>
          <Row label="Итого">
            {plans.map((p) => (
              <td key={p.id} className="px-4 py-2">
                {formatPrice(p.base_price)}
              </td>
            ))}
          </Row>
          <Row label="Экономия">
            {plans.map((p) => {
              const s = computeSavings(p.base_price, p.duration_days, monthlyAnchor);
              return (
                <td key={p.id} className="px-4 py-2 text-emerald-400">
                  {s.absolute > 0 ? `−${s.percent}% · ${formatPrice(s.absolute)}` : '—'}
                </td>
              );
            })}
          </Row>
          <Row label="До устройств">
            {plans.map((p) => (
              <td key={p.id} className="px-4 py-2">
                {p.max_devices} {pluralize(p.max_devices, ['устр-во', 'устр-ва', 'устр-в'])}
              </td>
            ))}
          </Row>
          <Row label="Длительность">
            {plans.map((p) => {
              const m = durationMonths(p.duration_days);
              return (
                <td key={p.id} className="px-4 py-2 text-slate-400">
                  {m} {pluralize(m, ['мес', 'мес', 'мес'])}
                </td>
              );
            })}
          </Row>
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="px-4 py-2 text-slate-500">{label}</td>
      {children}
    </tr>
  );
}
