'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Промежуточная страница для открытия custom URL схем (vless://, happ://, etc.)
 * из Telegram Mini App на iOS.
 * 
 * iOS Safari блокирует переходы на non-http(s) схемы из SFSafariViewController,
 * поэтому webApp.openLink() открывает эту страницу в обычном Safari,
 * где location.replace() на custom схему работает корректно.
 */

function OpenPageContent() {
  const searchParams = useSearchParams();
  const url = searchParams?.get('url') || '';

  useEffect(() => {
    if (!url) {
      document.body.innerHTML = `
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: system-ui, -apple-system, sans-serif;">
          <div>
            <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
            <h1 style="font-size: 24px; margin-bottom: 10px;">Ошибка</h1>
            <p style="color: #666;">URL не указан</p>
          </div>
        </div>
      `;
      return;
    }

    // Показываем индикатор загрузки
    document.body.innerHTML = `
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: system-ui, -apple-system, sans-serif;">
        <div>
          <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
          <h1 style="font-size: 24px; margin-bottom: 10px;">Открываем приложение...</h1>
          <p style="color: #666; margin-bottom: 20px;">Если приложение не открылось автоматически, нажмите кнопку ниже</p>
          <a href="${url}" onclick="window.location.href='${url}'; return false;" style="display: inline-block; background: #0088cc; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            Открыть вручную
          </a>
        </div>
      </div>
    `;

    // Пытаемся открыть URL через небольшую задержку
    const timer = setTimeout(() => {
      try {
        window.location.replace(url);
      } catch (err) {
        console.error('Failed to open URL:', err);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [url]);

  return null;
}

export default function OpenPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OpenPageContent />
    </Suspense>
  );
}
