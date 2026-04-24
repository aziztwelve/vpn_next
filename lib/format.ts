// Утилиты форматирования, общие для /plans, /plans/v2, /subscription, /history.
// Держим их в одном месте, чтобы UI не разъезжался (напр. "499 ₽" vs "499.00 ₽").

/** Склонение по русским правилам: pluralize(2, ['день','дня','дней']) → 'дня'. */
export function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

/** Длительность подписки из дней в человекочитаемый вид.
 *  У нас планы 30/90/180/365 — поэтому сначала try года, потом месяцы, потом дни. */
export function formatDuration(days: number): string {
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

/** `duration_days` → число месяцев для расчёта цены/мес. 1 год считаем как 12, а не 12.16. */
export function durationMonths(days: number): number {
  if (days === 365) return 12;
  return Math.round(days / 30);
}

/** Backend отдаёт decimal-строкой "499.00". В UI копейки показываем только если не .00. */
export function formatRub(price: string | number): string {
  const n = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(n)) return String(price);
  // toLocaleString даёт тонкий неразрывный пробел (U+202F) между тысячами —
  // на мобилках он рендерится корректно, в отличие от обычного пробела,
  // из-за которого цена в узкой колонке может переноситься.
  const fmt = (x: number) =>
    x.toLocaleString('ru-RU', {
      minimumFractionDigits: Number.isInteger(x) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  return fmt(n);
}

/** Полное «1 497 ₽» с валютным суффиксом. Используем везде, где есть место под ₽. */
export function formatPrice(price: string | number): string {
  return `${formatRub(price)} \u20BD`;
}

/** Цена за месяц для отображения «от 299 ₽/мес» в карточке тарифа.
 *  Возвращаем число — округление/форматирование на вызывающей стороне. */
export function pricePerMonth(totalRub: string | number, durationDays: number): number {
  const total = typeof totalRub === 'number' ? totalRub : Number(totalRub);
  const months = durationMonths(durationDays) || 1;
  return total / months;
}

/** Скидка относительно «если бы платил помесячно».
 *  monthlyAnchor — цена самого короткого плана (base_price 1 мес) в рублях.
 *  Возвращаем {percent, absolute} где percent округлён до int и не меньше 0. */
export function computeSavings(
  totalRub: string | number,
  durationDays: number,
  monthlyAnchor: string | number,
): { percent: number; absolute: number } {
  const total = typeof totalRub === 'number' ? totalRub : Number(totalRub);
  const monthly = typeof monthlyAnchor === 'number' ? monthlyAnchor : Number(monthlyAnchor);
  const months = durationMonths(durationDays);
  if (!Number.isFinite(total) || !Number.isFinite(monthly) || months <= 1) {
    return { percent: 0, absolute: 0 };
  }
  const ifPayMonthly = monthly * months;
  const absolute = Math.max(0, ifPayMonthly - total);
  const percent = ifPayMonthly > 0 ? Math.round((absolute / ifPayMonthly) * 100) : 0;
  return { percent, absolute };
}

/** Применение процентной скидки (промокод). Возвращает сумму в рублях, округлённую до копеек. */
export function applyDiscount(totalRub: string | number, discountPercent: number): number {
  const total = typeof totalRub === 'number' ? totalRub : Number(totalRub);
  if (!Number.isFinite(total) || discountPercent <= 0) return total;
  const capped = Math.min(100, Math.max(0, discountPercent));
  return Math.round(total * (1 - capped / 100) * 100) / 100;
}

/** Дата в коротком виде «27 апр 2026» для trial-бэйджей и «до такого-то». */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
