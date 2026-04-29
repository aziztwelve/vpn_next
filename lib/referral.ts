// ──────────────────────────────────────────────────────────────────
// Парсинг реферального start_param + типы для UI рефералки.
//
// Telegram Mini App запускается по deep-link'у вида
//   https://t.me/<bot>?startapp=ref_<token>
// — Telegram кладёт значение `ref_<token>` в
//   window.Telegram.WebApp.initDataUnsafe.start_param.
//
// Бэкенд (auth-service.ValidateTelegramUserRequest.ref_token) ждёт
// "чистый" токен без префикса `ref_`. Поэтому фронт обязан срезать
// префикс перед отправкой. Если start_param пустой / без префикса —
// возвращаем null (т.е. не реферал).
// ──────────────────────────────────────────────────────────────────

const REF_PREFIX = 'ref_';

/** Берёт чистый реферальный токен из start_param Telegram WebApp.
 *  Возвращает null, если start_param пустой или без префикса `ref_`.
 *
 *  Хранение: вызывающий код должен запомнить токен в localStorage
 *  до первой успешной валидации, потому что после ready/expand Telegram
 *  может уничтожить start_param (например, если юзер обновил страницу).
 */
export function parseRefToken(startParam: string | undefined | null): string | null {
  if (!startParam) return null;
  if (!startParam.startsWith(REF_PREFIX)) return null;
  const raw = startParam.slice(REF_PREFIX.length).trim();
  // Простая sanity-проверка: токены — base62, фиксированной длины 8 (см.
  // services/referral-service/internal/token/generator.go). Не валидируем
  // строго — пусть бэкенд решает: если токен битый, RegisterReferral
  // тихо пропустит регистрацию (best-effort).
  return raw.length > 0 ? raw : null;
}

const REF_TOKEN_LS_KEY = 'vpn_ref_token';

/** Кладёт токен в localStorage, если ещё нет. Вторичные запуски бота
 *  (без start_param) не должны затирать сохранённый токен — иначе теряем
 *  атрибуцию, если юзер сначала открыл Mini App, а зарегистрировался позже. */
export function persistRefToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!localStorage.getItem(REF_TOKEN_LS_KEY)) {
      localStorage.setItem(REF_TOKEN_LS_KEY, token);
    }
  } catch {
    // localStorage может быть недоступен (приватный режим / iframe квота) —
    // это не критично, просто токен не переживёт перезапуск.
  }
}

/** Возвращает сохранённый ref_token из localStorage. */
export function getStoredRefToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REF_TOKEN_LS_KEY);
  } catch {
    return null;
  }
}

/** Чистим токен — после успешной регистрации (или если ref_token уже
 *  «съел» бэкенд) хранить смысла нет. Не критично: бэкенд всё равно
 *  создаст relationship только при первой валидации нового юзера, для
 *  существующих пользователей RegisterReferral не вызывается. */
export function clearStoredRefToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REF_TOKEN_LS_KEY);
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────────────────────────
// API-типы (зеркало gateway → referral-service).
// ──────────────────────────────────────────────────────────────────

export interface ReferralLink {
  url: string;
  token: string;
  click_count: number;
}

export interface ReferralStats {
  invited_count: number;
  purchased_count: number;
  rewarded_days_total: number;
  /** Сумма всех начисленных за всю историю партнёрских комиссий (decimal-строка ₽). */
  earned_balance_rub_total: string;
  /** Текущий доступный для вывода баланс (decimal-строка ₽). */
  current_balance_rub: string;
  pending_count: number;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid' | string;

export interface WithdrawalRequest {
  id: number;
  amount_rub: string;
  payment_method: string;
  payment_details: Record<string, string>;
  status: WithdrawalStatus;
  admin_comment?: string;
  created_at: string;
  processed_at?: string;
}

export interface WithdrawalListResponse {
  requests: WithdrawalRequest[];
  total: number;
}
