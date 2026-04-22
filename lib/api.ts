const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api/v1';
const USE_PROXY = API_URL.startsWith('/api/proxy');

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
  base_price: string;
  is_active: boolean;
}

export interface DevicePrice {
  max_devices: number;
  price: string;
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
  status: string;
  created_at: string;
}

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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let url: string;
    if (USE_PROXY) {
      // Используем proxy route
      url = `${API_URL}?path=${encodeURIComponent(endpoint)}`;
    } else {
      // Прямой запрос к Gateway
      url = `${API_URL}${endpoint}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async validateTelegramUser(initData: string): Promise<{ user: User; jwt_token: string }> {
    const result = await this.request<{ user: User; jwt_token: string }>('/auth/validate', {
      method: 'POST',
      body: JSON.stringify({ init_data: initData }),
    });
    this.setToken(result.jwt_token);
    return result;
  }

  async getUser(userId: number): Promise<User> {
    return this.request<User>(`/auth/users/${userId}`);
  }

  // Subscriptions
  async listPlans(activeOnly: boolean = true): Promise<SubscriptionPlan[]> {
    const params = new URLSearchParams({ active_only: activeOnly.toString() });
    return this.request<SubscriptionPlan[]>(`/subscriptions/plans?${params}`);
  }

  async getDevicePricing(planId: number): Promise<DevicePrice[]> {
    return this.request<DevicePrice[]>(`/subscriptions/plans/${planId}/pricing`);
  }

  async getActiveSubscription(): Promise<{ subscription: Subscription | null; has_active: boolean }> {
    return this.request<{ subscription: Subscription | null; has_active: boolean }>('/subscriptions/active');
  }

  async createSubscription(planId: number, maxDevices: number, totalPrice: string): Promise<Subscription> {
    return this.request<Subscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        plan_id: planId,
        max_devices: maxDevices,
        total_price: totalPrice,
      }),
    });
  }

  async getSubscriptionHistory(): Promise<Subscription[]> {
    return this.request<Subscription[]>('/subscriptions/history');
  }
}

export const vpnApi = new VPNApiClient();
