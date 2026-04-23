'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTelegram } from './useTelegram';
import { vpnApi, type User, type ValidateTelegramResponse } from './api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

type TrialActivation = {
  subscription: NonNullable<ValidateTelegramResponse['subscription']>;
  /** Баннер «пробный период активирован» можно скрыть после показа. */
  dismiss: () => void;
};

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  /** Если в этой сессии только что активирован триал — возвращает объект,
   *  иначе null. Страницы могут показать баннер один раз. */
  trialActivation: TrialActivation | null;
  /** Перевалидировать initData и выпустить новый JWT. Вручную нужно редко. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { webApp, isReady: tgReady } = useTelegram();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trialSub, setTrialSub] = useState<NonNullable<ValidateTelegramResponse['subscription']> | null>(null);

  const authenticate = useCallback(async () => {
    // Нет Telegram SDK — мы не внутри Mini App (dev в обычном браузере).
    // Полезно на /test, но остальные страницы должны корректно обрабатывать.
    if (!webApp) {
      setStatus('unauthenticated');
      setUser(null);
      setError('Telegram WebApp недоступен — открой приложение из Telegram.');
      return;
    }

    const initData = webApp.initData;
    if (!initData) {
      setStatus('unauthenticated');
      setUser(null);
      setError('Пустой initData от Telegram — проверь настройки бота.');
      return;
    }

    try {
      setStatus('loading');
      const resp = await vpnApi.validateTelegramUser(initData);
      setUser(resp.user);
      setError(null);
      setStatus('authenticated');
      if (resp.trial_activated && resp.subscription) {
        setTrialSub(resp.subscription);
      } else {
        setTrialSub(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось авторизоваться';
      console.error('[auth] validate failed:', err);
      vpnApi.clearToken();
      setUser(null);
      setTrialSub(null);
      setError(msg);
      setStatus('error');
    }
  }, [webApp]);

  // Автологин как только Telegram готов.
  useEffect(() => {
    if (!tgReady) return;
    void authenticate();
  }, [tgReady, authenticate]);

  const trialActivation: TrialActivation | null = trialSub
    ? { subscription: trialSub, dismiss: () => setTrialSub(null) }
    : null;

  return (
    <AuthContext.Provider value={{ status, user, error, trialActivation, refresh: authenticate }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
