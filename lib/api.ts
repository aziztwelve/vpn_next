// API-клиент к vpn_go gateway. По умолчанию идём через Next.js route handler
// /api/proxy/* (см. app/api/proxy/[...path]/route.ts), чтобы не упираться
// в CORS и держать запросы same-origin с Mini App.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/proxy';

// ───── Типы ─────────────────────────────────────────────────────────

export interface User {
  id: number;
  telegram_id: number;
  username: string;
  first_name: string;
  last_name: string;
  photo_url: string;
  language_code: string;
  role: string;
  is_banned: boolean;
  balance: string;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  duration_days: number;
  max_devices: number;
  // base_price — цена в рублях (decimal-строка, "499.00"). Primary для UI.
  // price_stars считается на бэке из rub/rate — используется только для
  // инвойса Telegram Stars.
  base_price: string;
  price_stars: number;
  is_active: boolean;
}

export interface DevicePrice {
  max_devices: number;
  price: string;       // decimal-строка рубли — primary для UI
  price_stars: number; // derived из rub/rate — только для инвойса Telegram Stars
  plan_name: string;
}

export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'cancelled' | string;

// Ответ POST /auth/validate. Для новых юзеров backend сразу активирует
// триал — подписку, возвращает trial_activated=true + сокращённую версию
// subscription (только поля для баннера/виджета).
export interface ValidateTelegramResponse {
  user: User;
  jwt_token: string;
  trial_activated?: boolean;
  subscription?: {
    id: number;
    plan_id: number;
    plan_name: string;
    max_devices: number;
    expires_at: string;
    status: SubscriptionStatus;
  };
}

export interface Subscription {
  id: number;
  user_id: number;
  plan_id: number;
  plan_name: string;
  max_devices: number;
  total_price: string;
  started_at: string;
  expires_at: string;
  status: SubscriptionStatus;
  created_at: string;
}

export interface VPNServer {
  id: number;
  name: string;
  location: string;
  country_code: string;
  is_active?: boolean;
  load_percent?: number;
}

export interface VLESSLinkResponse {
  vless_link: string;
  current_devices: number;
  max_devices: number;
  connection_id: number;
  server: Pick<VPNServer, 'id' | 'name' | 'location' | 'country_code'>;
}

export interface ActiveConnection {
  id: number;
  server_id: number;
  server_name: string;
  device_identifier: string;
  connected_at: string;
  last_seen: string;
}

export interface SubscriptionTokenResponse {
  /** Публичный 48-hex токен. Виден в URL подписки. */
  subscription_token: string;
  /** Готовый URL для импорта в клиент: `{base}/api/v1/subscription/{token}`. */
  subscription_url: string;
  /** ISO-8601 UTC. Используется для заголовка Subscription-Userinfo expire=... */
  expires_at: string;
}

export interface ActiveConnectionsResponse {
  connections: ActiveConnection[];
  total_connections: number;
  max_devices: number;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | string;

/** Все поддерживаемые платёжные провайдеры. Держим union, чтобы TS ловил опечатки
 *  (selectedProvider === 'wata' вместо 'WATA'). Бэкенд принимает эти же строки. */
export type PaymentProvider = 'telegram_stars' | 'wata' | 'yoomoney';

export interface Payment {
  id: number;
  user_id: number;
  plan_id: number;
  max_devices: number;
  amount_stars: number;
  status: PaymentStatus;
  external_id: string;
  provider: string;
  created_at: string;
  paid_at: string;
}

export interface CreateInvoiceResponse {
  payment_id: number;
  invoice_link: string;
  amount_stars: number;
}

export interface CreateInvoiceOptions {
  provider?: PaymentProvider;
  // TODO(plans-v2): promoCode и autoRenew — добавить сюда после реализации
  // бэкенд-ручек. См. docs/tasks/09-plans-v2.md (Промокоды, Автопродление).
}

// ───── Ошибки ───────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = 'ApiError';
  }

  /** Достаёт машинно-читаемый `error`-код из JSON-ответа бэкенда,
   *  если тот отдал его в формате {"error":"...","message":"..."}.
   *  Нужен чтобы фронт мапил код на локализованный UX-текст,
   *  а не парсил технические сообщения руками. */
  get code(): string | null {
    if (this.body && typeof this.body === 'object' && 'error' in this.body) {
      const e = (this.body as { error: unknown }).error;
      return typeof e === 'string' ? e : null;
    }
    return null;
  }
}

// ───── Клиент ──────────────────────────────────────────────────────

class VPNApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vpn_token', token);
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('vpn_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vpn_token');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, { ...options, headers });

    // 204 No Content — ничего парсить не надо.
    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let body: unknown = text;
    if (text && response.headers.get('content-type')?.includes('application/json')) {
      try {
        body = JSON.parse(text);
      } catch {
        /* оставим как текст */
      }
    }

    if (!response.ok) {
      const asObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
      const pickString = (key: string): string | null =>
        asObj && typeof asObj[key] === 'string' ? (asObj[key] as string) : null;
      const message = pickString('message') ?? pickString('error') ?? `HTTP ${response.status}`;
      throw new ApiError(response.status, message, body);
    }

    return body as T;
  }

  // ─── Auth ─────────────────────────────────────────────────────────

  async validateTelegramUser(initData: string): Promise<ValidateTelegramResponse> {
    const result = await this.request<ValidateTelegramResponse>('/auth/validate', {
      method: 'POST',
      body: JSON.stringify({ init_data: initData }),
    });
    this.setToken(result.jwt_token);
    return result;
  }

  async getUser(userId: number): Promise<User> {
    return this.request<User>(`/auth/users/${userId}`);
  }

  // ─── Subscriptions ───────────────────────────────────────────────

  async listPlans(activeOnly: boolean = true): Promise<SubscriptionPlan[]> {
    const params = new URLSearchParams({ active_only: String(activeOnly) });
    return this.request<SubscriptionPlan[]>(`/subscriptions/plans?${params}`);
  }

  async getDevicePricing(planId: number): Promise<DevicePrice[]> {
    return this.request<DevicePrice[]>(`/subscriptions/plans/${planId}/pricing`);
  }

  async getActiveSubscription(): Promise<{ subscription: Subscription | null; has_active: boolean }> {
    return this.request<{ subscription: Subscription | null; has_active: boolean }>(
      '/subscriptions/active'
    );
  }

  async getSubscriptionHistory(): Promise<Subscription[]> {
    return this.request<Subscription[]>('/subscriptions/history');
  }

  // ─── VPN ──────────────────────────────────────────────────────────

  async listServers(activeOnly: boolean = true): Promise<VPNServer[]> {
    const params = new URLSearchParams({ active_only: String(activeOnly) });
    return this.request<VPNServer[]>(`/vpn/servers?${params}`);
  }

  /**
   * Получить VLESS-ссылку для устройства на выбранном сервере.
   * Может бросить ApiError(429) — device_limit_exceeded.
   */
  async getVLESSLink(serverId: number, deviceId: string): Promise<VLESSLinkResponse> {
    const params = new URLSearchParams({ device_id: deviceId });
    return this.request<VLESSLinkResponse>(`/vpn/servers/${serverId}/link?${params}`);
  }

  async getActiveConnections(): Promise<ActiveConnectionsResponse> {
    return this.request<ActiveConnectionsResponse>('/vpn/connections');
  }

  async disconnectDevice(connectionId: number): Promise<{ success: boolean; connection_id: number }> {
    return this.request<{ success: boolean; connection_id: number }>(`/vpn/devices/${connectionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Получить персональный токен подписки + готовый URL для клиентов
   * (Happ, Hiddify, Streisand, V2RayNG). Бросает ApiError(404) если у юзера
   * нет активной подписки (vpn_user ещё не создан или истекла).
   */
  async getSubscriptionToken(): Promise<SubscriptionTokenResponse> {
    return this.request<SubscriptionTokenResponse>('/vpn/subscription-token');
  }

  // ─── Payments (Telegram Stars / WATA / YooMoney) ──────────────────

  /**
   * Создать инвойс на оплату. Фронт потом открывает invoice_link через
   * Telegram.WebApp.openInvoice(link, cb) (для Stars) или openLink (WATA/YooMoney).
   *
   * Второй аргумент — либо строка-провайдер (обратная совместимость), либо
   * объект опций {provider}. Промокод и автопродление — см. TODO(plans-v2).
   */
  async createInvoice(
    planId: number,
    maxDevices: number,
    providerOrOptions: PaymentProvider | CreateInvoiceOptions = 'telegram_stars',
  ): Promise<CreateInvoiceResponse> {
    const provider =
      typeof providerOrOptions === 'string'
        ? providerOrOptions
        : providerOrOptions.provider ?? 'telegram_stars';

    const params = new URLSearchParams({ provider });
    return this.request<CreateInvoiceResponse>(`/payments?${params}`, {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, max_devices: maxDevices }),
    });
  }

  async listPayments(limit = 50, offset = 0): Promise<{ payments: Payment[] }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return this.request<{ payments: Payment[] }>(`/payments?${params}`);
  }

  /** Статус одного платежа — для /payment/pending (poll'им до paid/failed).
   *  TODO(plans-v2, backend): сделать отдельный `GET /payments/:id`; пока фильтруем listPayments. */
  async getPaymentStatus(paymentId: number): Promise<Payment | null> {
    const { payments } = await this.listPayments(100, 0);
    return payments.find((p) => p.id === paymentId) ?? null;
  }
}

export const vpnApi = new VPNApiClient();
