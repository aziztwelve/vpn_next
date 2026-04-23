'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/**
 * /open?url=<encoded custom-scheme URL>
 *
 * Зачем эта страница существует
 * ------------------------------
 * iOS-версия Telegram открывает Mini App в SFSafariViewController. Этот WebView
 * молча блокирует переходы на не-http(s) схемы (`happ://`, `v2raytun://`,
 * `hiddify://`, `streisand://`, `vless://`): клик по `<a href="happ://...">`
 * или `window.location.href = "happ://..."` не делает ничего.
 *
 * Обход: Mini App дергает `Telegram.WebApp.openLink(https-url)` — это
 * открывается во внешнем браузере (Safari). Та страница Safari-браузера
 * уже имеет право переходить на custom-схемы, и iOS подхватывает
 * зарегистрированное приложение.
 *
 * Эта `/open` и есть тот https-редиректор.
 *
 * Флоу:
 *  1. Mini App зовёт webApp.openLink(`${origin}/open?url=${encodeURIComponent("happ://...")}`)
 *  2. Safari открывает `/open`, читает `?url=...`
 *  3. `location.replace(decodedUrl)` → iOS запускает клиент
 *  4. Если клиент не установлен — показываем fallback со ссылками на сторы
 */

// Разрешённые схемы. Без этого `/open?url=http://evil.com` превратил бы нас
// в open-redirect → фишинг/SEO-poisoning. Обычные http(s) ссылки через
// редиректор пускать смысла нет (Telegram и так умеет их открывать).
const ALLOWED_SCHEMES = [
  'happ://',
  'v2raytun://',
  'hiddify://',
  'streisand://',
  'vless://',
  // Системные — редко полезно, но безопасно:
  'nekobox://',
  'clash://',
];

// Маппинг: scheme → человекочитаемое имя клиента + ссылки на сторы.
// Нужно для fallback-UI когда автоприложение не открылось (клиент не стоит).
//
// `vless://` — универсальная scheme, её клеймит любой VLESS-клиент, который
// установлен первым. В нашем UI её использует кнопка Happ (см. /connect),
// поэтому сториджи здесь указываем именно на Happ — самая частая iOS-цель
// для сырых vless-линков у RU-аудитории.
const CLIENT_INFO: Record<string, { name: string; ios?: string; android?: string }> = {
  'vless://': {
    name: 'Happ',
    ios: 'https://apps.apple.com/app/happ-proxy-utility/id6504287215',
    android: 'https://play.google.com/store/apps/details?id=com.happproxy',
  },
  'happ://': {
    name: 'Happ',
    ios: 'https://apps.apple.com/app/happ-proxy-utility/id6504287215',
    android: 'https://play.google.com/store/apps/details?id=com.happproxy',
  },
  'v2raytun://': {
    name: 'V2RayTun',
    ios: 'https://apps.apple.com/app/v2raytun/id6476628951',
    android: 'https://play.google.com/store/apps/details?id=com.v2raytun.android',
  },
  'hiddify://': {
    name: 'Hiddify',
    ios: 'https://apps.apple.com/app/hiddify-next/id6596777532',
    android: 'https://play.google.com/store/apps/details?id=app.hiddify.com',
  },
  'streisand://': {
    name: 'Streisand',
    ios: 'https://apps.apple.com/app/streisand/id6450534064',
  },
};

function detectClient(url: string): { scheme: string; name: string; ios?: string; android?: string } | null {
  for (const scheme of Object.keys(CLIENT_INFO)) {
    if (url.startsWith(scheme)) return { scheme, ...CLIENT_INFO[scheme] };
  }
  return null;
}

type State =
  | { kind: 'idle' }
  | { kind: 'redirecting'; url: string }
  | { kind: 'invalid'; reason: string };

export default function OpenPage() {
  // URL.searchParams на клиенте — нам Suspense-boundary не нужен, это чисто
  // runtime-page (prerender на SSR не имеет смысла: параметр всегда динамичен).
  const rawUrl = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('url');
  }, []);

  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    if (!rawUrl) {
      setState({ kind: 'invalid', reason: 'Параметр ?url= не передан.' });
      return;
    }

    const decoded = (() => {
      try {
        return decodeURIComponent(rawUrl);
      } catch {
        return rawUrl;
      }
    })();

    const isAllowed = ALLOWED_SCHEMES.some((s) => decoded.startsWith(s));
    if (!isAllowed) {
      setState({
        kind: 'invalid',
        reason: 'Неподдерживаемая схема. Разрешены только VPN-клиенты (happ, v2raytun, hiddify, streisand, vless).',
      });
      return;
    }

    setState({ kind: 'redirecting', url: decoded });

    // Микротаск чтобы React успел отрендерить fallback-UI перед тем,
    // как браузер переключит контекст на приложение (если оно установлено
    // и моментально забирает фокус — пользователь вернётся на эту же
    // страницу и увидит подсказку).
    const timer = window.setTimeout(() => {
      window.location.replace(decoded);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [rawUrl]);

  const client = state.kind === 'redirecting' ? detectClient(state.url) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-900 rounded-lg p-6 space-y-4">
        {state.kind === 'invalid' && (
          <>
            <h1 className="text-xl font-semibold text-red-300">Ссылка битая</h1>
            <p className="text-sm text-slate-300">{state.reason}</p>
            <Link
              href="/connect"
              className="inline-block bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Вернуться к подключению
            </Link>
          </>
        )}

        {state.kind === 'redirecting' && (
          <>
            <h1 className="text-xl font-semibold">
              Открываем {client ? client.name : 'клиент'}...
            </h1>
            <p className="text-sm text-slate-300">
              Если приложение не открылось автоматически — скорее всего оно не
              установлено. Поставь его и вернись по этой же ссылке.
            </p>

            {client && (client.ios || client.android) && (
              <div className="flex flex-col gap-2 pt-2">
                {client.ios && (
                  <a
                    href={client.ios}
                    className="bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2.5 text-sm font-semibold text-center"
                  >
                    Установить для iOS
                  </a>
                )}
                {client.android && (
                  <a
                    href={client.android}
                    className="bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2.5 text-sm font-semibold text-center"
                  >
                    Установить для Android
                  </a>
                )}
              </div>
            )}

            {/* Ручной re-launch — вдруг первый не сработал, а юзер уже
                поставил клиент. */}
            <button
              type="button"
              onClick={() => {
                window.location.replace(state.url);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              Открыть ещё раз
            </button>
          </>
        )}

        {state.kind === 'idle' && (
          <p className="text-slate-400 text-sm">Загрузка...</p>
        )}
      </div>
    </div>
  );
}
