// ──────────────────────────────────────────────────────────────────
// Маркетинговые воронки (кампании) — типы и хелперы для UI.
//
// Сущность отличается от персональной реф-ссылки: её создаёт админ и
// отдаёт блогеру/партнёру. Deep-link вида
//   https://t.me/<bot>?start=src_<slug>
// Атрибуция first-touch: один юзер — одна кампания на всё время.
//
// Бэкенд: gateway /api/v1/admin/campaigns/* (под RequireAdmin).
// ──────────────────────────────────────────────────────────────────

/** Slug-ограничение дублирует БД CHECK и бэкенд regex
 *  (см. services/referral-service/internal/model/campaign.go::CampaignSlugRegex).
 *  Используем для валидации формы создания ещё до round-trip'а. */
export const CAMPAIGN_SLUG_RE = /^[a-z0-9_-]{3,60}$/;

/** Потолок процента выплат партнёру по кампании (синхронизирован с БД
 *  CHECK и сервисной константой MaxPayoutPercent). */
export const CAMPAIGN_MAX_PAYOUT_PERCENT = 50;

export interface Campaign {
  id: number;
  slug: string;
  name: string;
  notes: string;
  /** 0 = не задан (кампания без партнёрских выплат). */
  partner_user_id: number;
  /** 0 = не задан. */
  payout_percent: number;
  is_active: boolean;
  created_by: number;
  created_at: string; // RFC3339
  /** "" если кампания активна. */
  archived_at: string;
  /** Готовый deep-link для шаринга блогеру: https://t.me/<bot>?start=src_<slug>. */
  deep_link: string;
}

export interface CampaignStats {
  campaign_id: number;
  /** Шаг 1: нажали /start в боте по этой воронке. */
  starts: number;
  /** Шаг 2: открыли Mini App = зарегистрировались (user_attribution). */
  opened_app: number;
  /** Шаг 3: активировали хоть какую-то подписку (trial или платную). */
  trial_activated: number;
  /** Шаг 4: совершили хотя бы одну успешную оплату. */
  paid_users: number;
  /** Суммарный revenue по оплатам кампании (decimal-строка ₽). */
  revenue_rub: string;
  /** Сумма, начисленная партнёру воронки (decimal-строка ₽). */
  partner_payouts_rub: string;
  /** Период, за который посчитана статистика (RFC3339 или ""). */
  from: string;
  to: string;
}

export interface CampaignWithStats {
  campaign: Campaign;
  stats: CampaignStats;
}

export interface CampaignListResponse {
  campaigns: CampaignWithStats[];
  total: number;
}

// ─── Helpers для UI ──────────────────────────────────────────────

/** Шаг воронки для отрисовки. Проценты — относительно предыдущего шага. */
export interface FunnelStep {
  label: string;
  count: number;
  /** Процент от предыдущего шага (null на первом шаге — не от чего считать). */
  conversion: number | null;
}

export function buildFunnel(stats: CampaignStats): FunnelStep[] {
  const pct = (n: number, d: number): number | null => {
    if (d <= 0) return null;
    return Math.round((n / d) * 1000) / 10; // 1 знак после запятой
  };
  return [
    { label: '/start в боте', count: stats.starts, conversion: null },
    { label: 'Открыли Mini App', count: stats.opened_app, conversion: pct(stats.opened_app, stats.starts) },
    { label: 'Активировали подписку', count: stats.trial_activated, conversion: pct(stats.trial_activated, stats.opened_app) },
    { label: 'Совершили оплату', count: stats.paid_users, conversion: pct(stats.paid_users, stats.opened_app) },
  ];
}

/** Форматирует decimal-строку ₽ с двумя знаками после запятой, с разделителями. */
export function formatRub(raw: string | number): string {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}
