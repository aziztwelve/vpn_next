'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Globe,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import {
  ApiError,
  vpnApi,
  type VLESSLinkResponse,
  type VPNServer,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTelegram } from '@/lib/useTelegram';

// device_id — это то, за что биндится слот лимита устройств.
// Генерим один раз на устройство, храним в localStorage.
const DEVICE_ID_KEY = 'vpn_device_id';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const rand =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    id = `web-${rand}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

type LinkState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: VLESSLinkResponse }
  | { kind: 'limit'; current: number; max: number; rawMessage: string }
  | { kind: 'error'; message: string };

/** Парсит "device limit exceeded: 1/2 devices active" → {current: 1, max: 2}.
 *  Если не распарсилось — возвращает {0, 0}, UI просто скроет счётчик. */
function parseDeviceLimitMessage(msg: string): { current: number; max: number } {
  const m = msg.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return { current: 0, max: 0 };
  return { current: parseInt(m[1], 10), max: parseInt(m[2], 10) };
}

export default function ConnectPage() {
  const { status, error: authError } = useAuth();
  const { hapticFeedback, showAlert, webApp } = useTelegram();

  const [servers, setServers] = useState<VPNServer[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [serversError, setServersError] = useState<string | null>(null);

  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [link, setLink] = useState<LinkState>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  // Загрузка серверов.
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    setServersLoading(true);
    setServersError(null);

    (async () => {
      try {
        const list = await vpnApi.listServers(true);
        if (cancelled) return;
        setServers(list ?? []);
        if (list && list.length > 0) {
          // Сервер с минимальной загрузкой — лучший дефолт.
          const best = [...list].sort(
            (a, b) => (a.load_percent ?? 0) - (b.load_percent ?? 0)
          )[0];
          setSelectedServerId(best.id);
        }
      } catch (err) {
        if (!cancelled) {
          setServersError(err instanceof Error ? err.message : 'Ошибка загрузки');
        }
      } finally {
        if (!cancelled) setServersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const fetchLink = useCallback(async () => {
    if (!selectedServerId || !deviceId) return;
    setLink({ kind: 'loading' });
    setCopied(false);
    try {
      const data = await vpnApi.getVLESSLink(selectedServerId, deviceId);
      setLink({ kind: 'ok', data });
      hapticFeedback('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429 && err.code === 'device_limit_exceeded') {
        const { current, max } = parseDeviceLimitMessage(err.message);
        setLink({ kind: 'limit', current, max, rawMessage: err.message });
        hapticFeedback('warning');
      } else {
        const msg = err instanceof Error ? err.message : 'Не удалось получить ключ';
        setLink({ kind: 'error', message: msg });
        hapticFeedback('error');
      }
    }
  }, [selectedServerId, deviceId, hapticFeedback]);

  // Как только выбран сервер и юзер авторизован — запрашиваем ключ.
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (selectedServerId == null) return;
    if (!deviceId) return;
    
    let cancelled = false;
    setLink({ kind: 'loading' });
    setCopied(false);
    
    (async () => {
      try {
        const data = await vpnApi.getVLESSLink(selectedServerId, deviceId);
        if (cancelled) return;
        setLink({ kind: 'ok', data });
        hapticFeedback('success');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 429 && err.code === 'device_limit_exceeded') {
          const { current, max } = parseDeviceLimitMessage(err.message);
          setLink({ kind: 'limit', current, max, rawMessage: err.message });
          hapticFeedback('warning');
        } else {
          const msg = err instanceof Error ? err.message : 'Не удалось получить ключ';
          setLink({ kind: 'error', message: msg });
          hapticFeedback('error');
        }
      }
    })();
    
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedServerId, deviceId]);

  const handleCopy = async () => {
    if (link.kind !== 'ok') return;
    try {
      await navigator.clipboard.writeText(link.data.vless_link);
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
   * Преобразует VLESS-ссылку в deeplink конкретного клиента.
   *
   * Happ — особый случай: его схема `happ://add/<b64>` предназначена ТОЛЬКО
   * для подписок (декодированное тело обязано быть https-URL'ом). Для
   * импорта одиночного vless-конфига Happ клеймит сам `vless://` scheme —
   * достаточно открыть ссылку как есть, iOS её отдаст Happ'у
   * (или любому другому VPN-клиенту, зарегистрированному на vless://).
   * Подтверждено: https://happ.su/main/faq/adding-configuration-subscription
   *
   * Остальные (V2RayTun/Hiddify/Streisand) используют собственную
   * `<scheme>://...` URI с URL-encoded payload'ом.
   */
  const buildClientDeeplinks = (vlessLink: string): { id: string; label: string; url: string }[] => {
    const encoded = encodeURIComponent(vlessLink);
    return [
      // Happ — открывается по vless:// scheme'у напрямую.
      { id: 'happ', label: 'Happ', url: vlessLink },
      // V2RayTun (Android/iOS) — принимает url-encoded vless.
      { id: 'v2raytun', label: 'V2RayTun', url: `v2raytun://import/${encoded}` },
      // Hiddify (cross-platform)
      { id: 'hiddify', label: 'Hiddify', url: `hiddify://install-config?url=${encoded}` },
      // Streisand (iOS)
      { id: 'streisand', label: 'Streisand', url: `streisand://import/${encoded}` },
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
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center">
          <Link href="/" className="mr-4" aria-label="Назад">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">Подключение</h1>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" /> Сервер
          </h2>
          {serversLoading && <p className="text-slate-400">Загружаем список серверов...</p>}
          {serversError && <p className="text-red-400">{serversError}</p>}
          {!serversLoading && !serversError && servers.length === 0 && (
            <p className="text-slate-400">Серверов пока нет. Зайди позже.</p>
          )}
          <div className="grid gap-2">
            {servers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedServerId(s.id);
                  hapticFeedback('light');
                }}
                className={`flex items-center justify-between bg-slate-900 rounded-lg p-4 border-2 transition text-left ${
                  selectedServerId === s.id
                    ? 'border-blue-500'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <p className="font-medium">
                    {flagEmoji(s.country_code)} {s.name}
                  </p>
                  <p className="text-slate-400 text-sm">{s.location}</p>
                </div>
                <LoadBadge percent={s.load_percent ?? 0} />
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-400" /> Твой ключ
          </h2>

          {link.kind === 'idle' && (
            <p className="text-slate-400 text-sm">Выбери сервер, чтобы получить ссылку.</p>
          )}

          {link.kind === 'loading' && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Запрашиваем VLESS-ссылку...
            </div>
          )}

          {link.kind === 'limit' && (
            <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-4 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-yellow-100">Достигнут лимит устройств</p>
                  {link.max > 0 && (
                    <p className="text-sm text-yellow-200/90 mt-1">
                      Подключено <span className="font-mono font-semibold">{link.current}/{link.max}</span>.
                      Отключи одно из активных устройств — или купи тариф с большим лимитом.
                    </p>
                  )}
                  {link.max === 0 && (
                    <p className="text-sm text-yellow-200/90 mt-1">{link.rawMessage}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/devices"
                  className="inline-flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
                >
                  <Smartphone className="w-4 h-4" />
                  Мои устройства
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg px-4 py-2.5 text-sm font-semibold transition border border-slate-700"
                >
                  <CreditCard className="w-4 h-4" />
                  Тарифы
                </Link>
              </div>

              <p className="text-xs text-yellow-200/60">
                Слот освободится автоматически через 5 минут после того, как устройство перестанет обновлять подключение.
              </p>
            </div>
          )}

          {link.kind === 'error' && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-4">
              <p className="text-sm mb-3">{link.message}</p>
              <button
                type="button"
                onClick={() => void fetchLink()}
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2 text-sm transition"
              >
                <RefreshCw className="w-4 h-4" /> Повторить
              </button>
            </div>
          )}

          {link.kind === 'ok' && (
            <div className="bg-slate-900 rounded-lg p-6 space-y-5">
              <div className="flex justify-between items-center text-sm text-slate-400">
                <span>
                  Устройства: {link.data.current_devices}/{link.data.max_devices}
                </span>
                <button
                  type="button"
                  onClick={() => void fetchLink()}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <RefreshCw className="w-3 h-3" /> обновить
                </button>
              </div>

              {/* QR — самый универсальный способ. Сканируется любым VLESS-клиентом
                  (Happ, V2RayTun, Hiddify, NekoBox, ...) без привязки к ОС/схеме. */}
              <div className="flex flex-col items-center gap-3 bg-white rounded-lg p-4">
                <QRCodeSVG
                  value={link.data.vless_link}
                  size={220}
                  level="M"
                  marginSize={2}
                  className="rounded"
                />
                <p className="text-slate-700 text-xs text-center max-w-[220px]">
                  Наведи камеру или VPN-клиент на QR — он импортирует подключение сам.
                </p>
              </div>

              <details className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <summary className="text-slate-400 text-xs cursor-pointer select-none">
                  Показать VLESS-ссылку
                </summary>
                <p className="text-slate-200 text-xs font-mono break-all leading-relaxed mt-2">
                  {link.data.vless_link}
                </p>
              </details>

              <div>
                <p className="text-slate-400 text-xs mb-2">Или открой в приложении:</p>
                <div className="grid grid-cols-2 gap-2">
                  {buildClientDeeplinks(link.data.vless_link).map((dl) => (
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
              </div>


              <div className="bg-blue-500/10 border border-blue-500/40 rounded-lg p-4">
                <p className="text-blue-200 text-sm font-semibold mb-2">🎉 Подписка с 3 режимами</p>
                <p className="text-blue-200/80 text-xs mb-3">
                  Добавь подписку и выбери режим: 🚀 Обход блокировок, 🔒 Весь трафик, 🎬 YouTube без рекламы
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const subscriptionUrl = 'https://cdn.osmonai.com/api/v1/subscription/test';
                      const deeplink = `happ://add/${subscriptionUrl}`;
                      if (webApp?.openLink) {
                        const redirectUrl = `${window.location.origin}/open?url=${encodeURIComponent(deeplink)}`;
                        webApp.openLink(redirectUrl);
                      } else {
                        openDeeplink(deeplink);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 rounded-lg py-2.5 text-sm font-semibold transition"
                  >
                    Happ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const subscriptionUrl = 'https://cdn.osmonai.com/api/v1/subscription/test';
                      const deeplink = `v2raytun://install-sub?url=${encodeURIComponent(subscriptionUrl)}`;
                      if (webApp?.openLink) {
                        const redirectUrl = `${window.location.origin}/open?url=${encodeURIComponent(deeplink)}`;
                        webApp.openLink(redirectUrl);
                      } else {
                        openDeeplink(deeplink);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 rounded-lg py-2.5 text-sm font-semibold transition"
                  >
                    V2RayTun
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const subscriptionUrl = 'https://cdn.osmonai.com/api/v1/subscription/test';
                      const deeplink = `hiddify://install-sub?url=${encodeURIComponent(subscriptionUrl)}`;
                      if (webApp?.openLink) {
                        const redirectUrl = `${window.location.origin}/open?url=${encodeURIComponent(deeplink)}`;
                        webApp.openLink(redirectUrl);
                      } else {
                        openDeeplink(deeplink);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 rounded-lg py-2.5 text-sm font-semibold transition"
                  >
                    Hiddify
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const subscriptionUrl = 'https://cdn.osmonai.com/api/v1/subscription/test';
                      const deeplink = `streisand://install-sub?url=${encodeURIComponent(subscriptionUrl)}`;
                      if (webApp?.openLink) {
                        const redirectUrl = `${window.location.origin}/open?url=${encodeURIComponent(deeplink)}`;
                        webApp.openLink(redirectUrl);
                      } else {
                        openDeeplink(deeplink);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 rounded-lg py-2.5 text-sm font-semibold transition"
                  >
                    Streisand
                  </button>
                </div>
              </div>
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
