'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Loader2,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { ApiError, vpnApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTelegram } from '@/lib/useTelegram';

// Состояние блока с QR/ссылкой подписки. Источник — GET /vpn/subscription-token.
// Сам vless:// больше не дёргается на этой странице: subscription_url ведёт
// на универсальный конфиг подписки (Happ/Hiddify/V2RayTun/Streisand сами
// разбираются как его раскрутить).
type SubState =
  | { kind: 'loading' }
  | { kind: 'ok'; url: string }
  | { kind: 'no_subscription' }
  | { kind: 'error'; message: string };

export default function ConnectPage() {
  const { status, error: authError } = useAuth();
  const { hapticFeedback, showAlert, webApp } = useTelegram();

  const [sub, setSub] = useState<SubState>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);
  const [selectedOS, setSelectedOS] = useState<string>('ios');
  const [showDownloadInfo, setShowDownloadInfo] = useState(false);

  // Определяем ОС автоматически
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) {
      setSelectedOS('android');
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      setSelectedOS('ios');
    } else if (ua.includes('win')) {
      setSelectedOS('windows');
    } else if (ua.includes('linux')) {
      setSelectedOS('linux');
    }
  }, []);

  const getAppLink = (os: string) => {
    const links: Record<string, string> = {
      ios: 'https://apps.apple.com/tj/app/happ-proxy-utility/id6504287215',
      android: 'https://play.google.com/store/apps/details?id=com.happ.vpn',
      windows: 'https://github.com/happ-vpn/releases/download/v1.0.0/Happ-Setup.exe',
      linux: 'https://github.com/happ-vpn/releases/download/v1.0.0/Happ-Linux.AppImage',
    };
    return links[os] || links.ios;
  };

  const getAlternativeApps = () => [
    { name: 'Happ', url: 'https://apps.apple.com/tj/app/happ-proxy-utility/id6504287215' },
    { name: 'V2RayTun', url: 'https://apps.apple.com/tj/app/v2raytun/id6476628951' },
    { name: 'Hiddify', url: 'https://apps.apple.com/tj/app/hiddify-proxy-vpn/id6596777532' },
    { name: 'INCY', url: 'https://apps.apple.com/tj/app/incy/id6756943388' },
  ];

  // Загрузка subscription URL после auth.
  // URL берём из ответа бэка: `subscription_url`. Он строится в gateway из
  // env PUBLIC_BASE_URL = https://cdn.osmonai.com. Нельзя полагаться на
  // window.location.origin, т.к. Mini App может быть открыт через dev-URL
  // (127.0.0.1:<port>), а Happ на телефоне не достучится до этого хоста.
  // 404 от бэка → no_subscription (не ошибка, юзер просто ещё не оплатил).
  const fetchSubscription = async () => {
    setSub({ kind: 'loading' });
    setCopied(false);
    try {
      const resp = await vpnApi.getSubscriptionToken();
      setSub({ kind: 'ok', url: resp.subscription_url });
      hapticFeedback('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setSub({ kind: 'no_subscription' });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Не удалось получить ссылку';
      setSub({ kind: 'error', message: msg });
      hapticFeedback('error');
    }
  };

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await vpnApi.getSubscriptionToken();
        if (cancelled) return;
        setSub({ kind: 'ok', url: resp.subscription_url });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setSub({ kind: 'no_subscription' });
          return;
        }
        const msg = err instanceof Error ? err.message : 'Не удалось получить ссылку';
        setSub({ kind: 'error', message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const handleCopy = async () => {
    if (sub.kind !== 'ok') return;
    try {
      await navigator.clipboard.writeText(sub.url);
      setCopied(true);
      hapticFeedback('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert('Не получилось скопировать — выдели ссылку вручную.');
    }
  };

  /**
   * Открыть custom-URL схему (vless://, happ://, v2raytun://, ...) из MiniApp.
   *
   * Проблема: iOS-Telegram запускает Mini App в SFSafariViewController, который
   * молча блокирует переходы на не-http(s) схемы. Ни `<a>.click()`, ни
   * `window.location.href` не срабатывают — клик превращается в no-op.
   *
   * Решение: дёргаем `Telegram.WebApp.openLink(https://.../open?url=...)` — это
   * открывает внешнюю Safari-сессию, где мы можем делать `location.replace()`
   * на custom-схему. iOS подхватывает зарегистрированное приложение.
   *
   * Вне Telegram (desktop/web-браузер) — просто пытаемся перейти напрямую,
   * этого достаточно.
   */
  const openDeeplink = useCallback(
    (url: string) => {
      hapticFeedback('light');

      if (webApp?.openLink) {
        const redirectUrl = `${window.location.origin}/open?url=${encodeURIComponent(url)}`;
        webApp.openLink(redirectUrl);
        return;
      }

      // Fallback — не в Telegram или API недоступен.
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [hapticFeedback, webApp],
  );

  /**
   * Преобразует URL подписки в deeplink конкретного VPN-клиента.
   *
   * Все 4 клиента принимают подписку по https-URL'у, различие — в scheme/пути:
   *   - Happ: `happ://add/<raw https-url>` (без url-encode, см.
   *     https://happ.su/main/faq/adding-configuration-subscription)
   *   - V2RayTun: `v2raytun://import/<url-encoded url>` — тот же import-хэндлер,
   *     что и для одиночных конфигов, приложение само детектит тип ответа.
   *   - Hiddify: `hiddify://install-sub?url=<url-encoded url>`
   *   - INCY: `incy://add/<raw https-url>` — та же конвенция что у Happ.
   */
  const buildSubscriptionDeeplinks = (
    subUrl: string,
  ): { id: string; label: string; url: string }[] => {
    const encoded = encodeURIComponent(subUrl);
    return [
      { id: 'happ', label: 'Happ', url: `happ://add/${subUrl}` },
      { id: 'v2raytun', label: 'V2RayTun', url: `v2raytun://import/${encoded}` },
      { id: 'hiddify', label: 'Hiddify', url: `hiddify://install-sub?url=${encoded}` },
      { id: 'incy', label: 'INCY', url: `incy://add/${subUrl}` },
    ];
  };

  if (status === 'loading') return <Loader label="Авторизация..." />;

  if (status !== 'authenticated') {
    return (
      <ErrorScreen message={authError ?? 'Нужна авторизация через Telegram.'}>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 inline-block">
          На главную
        </Link>
      </ErrorScreen>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center">
          <Link href="/" className="mr-4" aria-label="Назад">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">Подключение</h1>
        </div>

        {/* Select для выбора ОС */}
        <section className="bg-slate-900 rounded-lg p-4">
          <select
            value={selectedOS}
            onChange={(e) => setSelectedOS(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ios">iOS (iPhone/iPad)</option>
            <option value="android">Android</option>
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
          </select>
        </section>

        {/* Альтернативные приложения для iOS */}
        {selectedOS === 'ios' && (
          <section className="bg-slate-900 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Приложения для iOS</h3>
            <div className="grid grid-cols-2 gap-2">
              {getAlternativeApps().map((app) => (
                <a
                  key={app.name}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg py-2.5 text-sm font-semibold transition"
                >
                  {app.name}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Раскрывающийся блок со ссылкой на скачивание */}
        <section className="bg-slate-900 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDownloadInfo(!showDownloadInfo)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition"
          >
            <span className="text-sm font-semibold text-slate-300">Прямая ссылка на скачивание</span>
            <span className="text-slate-400">{showDownloadInfo ? '▼' : '▶'}</span>
          </button>
          {showDownloadInfo && (
            <div className="p-4 pt-0 space-y-3">
              <p className="text-slate-400 text-sm">
                Скачайте приложение напрямую для {selectedOS === 'ios' ? 'iOS' : selectedOS === 'android' ? 'Android' : selectedOS === 'linux' ? 'Linux' : 'Windows'}
              </p>
              <a
                href={getAppLink(selectedOS)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 rounded-lg p-3 transition font-medium"
              >
                Перейти к скачиванию
              </a>
            </div>
          )}
        </section>

        {/* Или открой в приложении */}
        <section className="bg-slate-900 rounded-lg p-4 space-y-3">
          <p className="text-slate-400 text-sm">Или открой в приложении:</p>
          {sub.kind === 'no_subscription' && (
            <p className="text-rose-300/80 text-xs">
              Нет активной подписки. Купи подписку чтобы получить ссылку импорта.
            </p>
          )}
          {sub.kind === 'ok' ? (
            <div className="grid grid-cols-2 gap-2">
              {buildSubscriptionDeeplinks(sub.url).map((dl) => (
                <button
                  key={dl.id}
                  type="button"
                  onClick={() => openDeeplink(dl.url)}
                  className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-lg py-2.5 text-sm font-semibold transition"
                >
                  {dl.label}
                </button>
              ))}
            </div>
          ) : sub.kind === 'loading' ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загружаем ссылку подписки...
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-400" /> Твой ключ
          </h2>

          {sub.kind === 'loading' && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Запрашиваем ссылку подписки...
            </div>
          )}

          {sub.kind === 'no_subscription' && (
            <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-4 space-y-4">
              <p className="text-sm text-yellow-100">
                Нет активной подписки — купи тариф, чтобы получить ссылку для подключения.
              </p>
              <Link
                href="/plans"
                className="inline-flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
              >
                <CreditCard className="w-4 h-4" />
                Тарифы
              </Link>
            </div>
          )}

          {sub.kind === 'error' && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-4">
              <p className="text-sm mb-3">{sub.message}</p>
              <button
                type="button"
                onClick={() => void fetchSubscription()}
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2 text-sm transition"
              >
                <RefreshCw className="w-4 h-4" /> Повторить
              </button>
            </div>
          )}

          {sub.kind === 'ok' && (
            <div className="bg-slate-900 rounded-lg p-6 space-y-5">
              <div className="flex justify-end items-center text-sm text-slate-400">
                <button
                  type="button"
                  onClick={() => void fetchSubscription()}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <RefreshCw className="w-3 h-3" /> обновить
                </button>
              </div>

              {/* QR подписки — клиенты (Happ/Hiddify/V2RayTun/Streisand) сами
                  стянут полный конфиг по этой ссылке и подхватят все сервера
                  + актуальные ключи Reality. */}
              <div className="flex flex-col items-center gap-3 bg-white rounded-lg p-4">
                <QRCodeSVG
                  value={sub.url}
                  size={220}
                  level="M"
                  marginSize={2}
                  className="rounded"
                />
                <p className="text-slate-700 text-xs text-center max-w-[220px]">
                  Наведи камеру или VPN-клиент на QR — он импортирует подписку сам.
                </p>
              </div>

              <details className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <summary className="text-slate-400 text-xs cursor-pointer select-none">
                  Показать ссылку подписки
                </summary>
                <p className="text-slate-200 text-xs font-mono break-all leading-relaxed mt-2">
                  {sub.url}
                </p>
              </details>


              <button
                type="button"
                onClick={handleCopy}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-lg py-3 font-semibold transition"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Скопировано' : 'Скопировать ссылку'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function LoadBadge({ percent }: { percent: number }) {
  const color =
    percent < 50 ? 'text-green-400' : percent < 80 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-sm font-mono ${color}`}>{percent}%</span>;
}

// Небольшая флагизация — дешёво и сердито (ISO-3166-1 alpha-2 → emoji).
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  const A = 0x1f1e6;
  const base = 'A'.charCodeAt(0);
  const u = code.toUpperCase();
  return String.fromCodePoint(A + u.charCodeAt(0) - base) +
    String.fromCodePoint(A + u.charCodeAt(1) - base);
}

function Loader({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-red-400 mb-4">{message}</p>
        {children}
      </div>
    </div>
  );
}
