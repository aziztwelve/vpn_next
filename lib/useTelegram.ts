"use client";

import { useEffect, useState } from 'react';
import type { TelegramWebApp, TelegramUser } from './telegram';

export function useTelegram() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Ждем загрузки Telegram WebApp SDK
    const initTelegram = () => {
      const tg = window.Telegram?.WebApp;
      
      if (tg) {
        tg.ready();
        tg.expand();
        
        setWebApp(tg);
        setUser(tg.initDataUnsafe.user || null);
        setIsReady(true);

        // Применяем тему Telegram
        if (tg.colorScheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        // Если SDK еще не загружен, показываем контент через 2 секунды
        setTimeout(() => {
          if (!window.Telegram?.WebApp) {
            setIsReady(true); // Показываем demo режим
          }
        }, 2000);
      }
    };

    // Пробуем сразу
    if (window.Telegram?.WebApp) {
      initTelegram();
    } else {
      // Ждем загрузки скрипта
      const checkInterval = setInterval(() => {
        if (window.Telegram?.WebApp) {
          clearInterval(checkInterval);
          initTelegram();
        }
      }, 100);

      // Таймаут 3 секунды
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.Telegram?.WebApp) {
          setIsReady(true); // Показываем demo режим
        }
      }, 3000);

      return () => clearInterval(checkInterval);
    }
  }, []);

  const showMainButton = (text: string, onClick: () => void) => {
    if (webApp?.MainButton) {
      webApp.MainButton.setText(text);
      webApp.MainButton.onClick(onClick);
      webApp.MainButton.show();
    }
  };

  const hideMainButton = () => {
    if (webApp?.MainButton) {
      webApp.MainButton.hide();
    }
  };

  const showBackButton = (onClick: () => void) => {
    if (webApp?.BackButton) {
      webApp.BackButton.onClick(onClick);
      webApp.BackButton.show();
    }
  };

  const hideBackButton = () => {
    if (webApp?.BackButton) {
      webApp.BackButton.hide();
    }
  };

  const hapticFeedback = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') => {
    if (webApp?.HapticFeedback) {
      if (type === 'success' || type === 'error' || type === 'warning') {
        webApp.HapticFeedback.notificationOccurred(type);
      } else {
        webApp.HapticFeedback.impactOccurred(type);
      }
    }
  };

  const close = () => {
    webApp?.close();
  };

  const showAlert = (message: string) => {
    webApp?.showAlert(message);
  };

  const showConfirm = (message: string, callback: (confirmed: boolean) => void) => {
    webApp?.showConfirm(message, callback);
  };

  return {
    webApp,
    user,
    isReady,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
    hapticFeedback,
    close,
    showAlert,
    showConfirm,
  };
}
