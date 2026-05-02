'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Cat,
  Check,
  ChevronDown,
  CloudDownload,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Ghost,
  Loader2,
  type LucideIcon,
  Plus,
  QrCode,
  RefreshCw,
  Settings,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { ApiError, vpnApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTelegram } from '@/lib/useTelegram';

// ─────────────────────────────────────────────────────────────
// Дизайн-токены (маппинг спеки → tailwind):
//   dark-100/200    → slate-100/200    (заголовки/основной текст)
//   dark-400        → slate-400        (описания)
//   dark-700/50     → slate-700/50     (бордер карточек)
//   dark-800/50,80  → slate-800/50,80  (фон карточек/кнопок-клиентов)
//   dark-600        → slate-600        (hover-бордер)
//   accent-400/500  → cyan-400/500     (rgba(34,211,238) = cyan-400)
//   teal/green icon → emerald-500      (rgba(32,201,151) ≈ emerald-500)
//
// Иконные круги 44×44 с градиентом — inline-style, потому что значения
// arbitrary и не повторяются за пределами этой страницы.
// ─────────────────────────────────────────────────────────────

const ICON_TILE_CYAN_BG =
  'linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(34, 211, 238, 0.08) 100%)';
const ICON_TILE_CYAN_BORDER = '1px solid rgba(34, 211, 238, 0.3)';

const ICON_TILE_EMERALD_BG =
  'linear-gradient(135deg, rgba(32, 201, 151, 0.15) 0%, rgba(32, 201, 151, 0.08) 100%)';
const ICON_TILE_EMERALD_BORDER = '1px solid rgba(32, 201, 151, 0.3)';

// Violet — для блока «Установка приложения» на iOS (отличает от cyan
// blocks и подсказывает, что установка через App Store идёт другим путём).
const ICON_TILE_VIOLET_BG =
  'linear-gradient(135deg, rgba(151, 117, 250, 0.15) 0%, rgba(151, 117, 250, 0.08) 100%)';
const ICON_TILE_VIOLET_BORDER = '1px solid rgba(151, 117, 250, 0.3)';

// ─────────────────────────────────────────────────────────────
// Платформы и клиенты
// ─────────────────────────────────────────────────────────────

type PlatformId = 'macos' | 'ios' | 'windows' | 'android' | 'linux';

const PLATFORMS: { id: PlatformId; label: string; icon: string }[] = [
  { id: 'macos', label: 'macOS', icon: '' },
  { id: 'ios', label: 'iOS', icon: '' },
  { id: 'windows', label: 'Windows', icon: '⊞' },
  { id: 'android', label: 'Android', icon: '🤖' },
  { id: 'linux', label: 'Linux', icon: '🐧' },
];

type ClientId = 'happ' | 'incy' | 'flclashx' | 'koala' | 'prizrak';

type DownloadLink = { label: string; url: string };

// Состояние подписки. 404 от бэка — это not-error: пользователь просто
// ещё не оплатил тариф (или подписка истекла), показываем CTA на /plans.
type SubState =
  | { kind: 'loading' }
  | { kind: 'ok'; url: string }
  | { kind: 'no_subscription' }
  | { kind: 'error'; message: string };

type ClientDef = {
  id: ClientId;
  name: string;
  // SVG-иконка справа в карточке клиента (h-7 w-7 opacity-30).
  Icon: LucideIcon;
  // Платформы, на которых клиент маркируется как «рекомендуется» (amber-точка).
  // На остальных платформах он показывается без точки. Если у клиента нет
  // entry в `stores[platform]` — он вообще скрывается (см. visibleClients).
  recommendedOn?: PlatformId[];
  // Билдер deeplink из subscription URL (raw https).
  buildDeeplink: (subUrl: string) => string;
  // Магазины приложений по платформам. Если для платформы нет записи —
  // клиент не показывается в сетке (см. visibleClients).
  stores: Partial<Record<PlatformId, DownloadLink[]>>;
  // Описание для блока «Добавление подписки» (Block 3). Зависит от того,
  // умеет ли клиент авто-импорт по deeplink (Happ) или просит ручного
  // действия после открытия (FlClashX и Clash-производные).
  addSubscriptionDescription: string;
  // Текст для блока «Если подписка не добавилась» (Block 4). Если нет —
  // блок скрывается. Может содержать \n для абзацев.
  manualInstructions?: string;
  // Текст для блока «Подключение и использование» (Block 5).
  connectInstructions: string;
  // Переопределения текстов под конкретные платформы. Используются если
  // на платформе UX отличается (например, Happ на Android — короткие
  // подсказки, на macOS/iOS — подробные с описанием авто-импорта).
  perPlatform?: Partial<
    Record<
      PlatformId,
      {
        addSubscriptionDescription?: string;
        connectInstructions?: string;
        manualInstructions?: string;
      }
    >
  >;
};

// macOS RU использует «Happ Plus» (id 6746188973) — отдельный listing для RU
// без NetworkExtension-ограничений App Store. iOS RU использует обычный Happ.
const HAPP_MACOS_APPSTORE_RU =
  'https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6746188973';
const HAPP_APPSTORE_RU = 'https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6746188973';
const HAPP_APPSTORE_GLOBAL = 'https://apps.apple.com/us/app/happ-proxy-utility/id6504287215';

const CLIENTS: ClientDef[] = [
  {
    id: 'happ',
    name: 'Happ',
    Icon: Zap,
    // Happ — мобильный first, на iOS/Android/macOS рекомендуем. На
    // Windows есть desktop-билд, но это не дефолт-выбор → без amber-точки.
    recommendedOn: ['macos', 'ios', 'android'],
    // Happ: `happ://add/<raw https-url>` без url-encode (см. happ.su FAQ).
    buildDeeplink: (sub) => `happ://add/${sub}`,
    stores: {
      macos: [
        { label: 'App Store (RU)', url: HAPP_MACOS_APPSTORE_RU },
        { label: 'App Store (Global)', url: HAPP_APPSTORE_GLOBAL },
      ],
      ios: [
        { label: 'App Store (RU)', url: HAPP_APPSTORE_RU },
        { label: 'App Store (Global)', url: HAPP_APPSTORE_GLOBAL },
      ],
      android: [
        {
          label: 'Открыть в Google Play',
          url: 'https://play.google.com/store/apps/details?id=com.happproxy',
        },
        {
          label: 'Скачать APK',
          url: 'https://github.com/Happ-proxy/happ-android/releases/latest',
        },
      ],
      windows: [
        {
          label: 'Скачать (Global)',
          url: 'https://github.com/Happ-proxy/happ-desktop/releases/latest',
        },
      ],
      // Happ-desktop для Linux пока не публикуется отдельным билдом —
      // карточка скрыта на Linux.
    },
    addSubscriptionDescription:
      'Нажмите кнопку ниже — приложение откроется, и подписка добавится автоматически.',
    connectInstructions:
      'В главном разделе нажмите большую кнопку включения в центре для подключения к VPN. Не забудьте выбрать сервер в списке серверов. При необходимости выберите другой сервер из списка серверов.',
    perPlatform: {
      // Android-Happ показывает более лаконичные тексты (ближе к гайду
      // приложения в Google Play).
      android: {
        addSubscriptionDescription: 'Нажмите кнопку ниже, чтобы добавить подписку.',
        connectInstructions: 'Откройте приложение и подключитесь к серверу.',
      },
    },
  },
  {
    id: 'incy',
    name: 'INCY',
    // Та же иконка-молния что у Happ — клиенты «как родственники» в UI.
    Icon: Zap,
    // INCY есть и на Android (Play Store), на остальных платформах нет.
    recommendedOn: ['ios', 'android'],
    // Та же конвенция что у Happ: incy://add/<raw https-url> без url-encode.
    buildDeeplink: (sub) => `incy://add/${sub}`,
    stores: {
      ios: [{ label: 'App Store', url: 'https://apps.apple.com/app/incy/id6756943388' }],
      android: [
        {
          label: 'Открыть в Google Play',
          url: 'https://play.google.com/store/apps/details?id=org.incy.app',
        },
      ],
    },
    addSubscriptionDescription:
      'Нажмите кнопку ниже — приложение откроется, и подписка добавится автоматически.',
    connectInstructions:
      'На главном экране нажмите большую кнопку включения для подключения к VPN. Не забудьте выбрать сервер из списка.',
  },
  {
    id: 'flclashx',
    name: 'FlClashX',
    Icon: Sparkles,
    // FlClashX — универсальный clash-клиент для desktop. На мобильных
    // (iOS/Android) у нас сейчас только INCY + Happ, поэтому FlClashX
    // там не показываем.
    recommendedOn: ['macos', 'windows', 'linux'],
    // FlClashX = форк FlClash, принимает clash-схему и https-импорт.
    buildDeeplink: (sub) => `clash://install-config?url=${encodeURIComponent(sub)}`,
    stores: {
      macos: [
        {
          label: 'Скачать (Global)',
          url: 'https://github.com/pluralplay/FlClashX/releases/latest',
        },
      ],
      // iOS/Android пропущены: на мобильных показываем только INCY + Happ.
      windows: [
        {
          label: 'Windows (Установщик)',
          url: 'https://github.com/pluralplay/FlClashX/releases/latest/download/FlClashX-windows-amd64-setup.exe',
        },
        {
          label: 'Windows на ARM (Установщик)',
          url: 'https://github.com/pluralplay/FlClashX/releases/latest/download/FlClashX-windows-arm64-setup.exe',
        },
      ],
      linux: [
        {
          label: 'amd64 (.deb)',
          url: 'https://github.com/pluralplay/FlClashX/releases/latest/download/FlClashX-linux-amd64.deb',
        },
        {
          label: 'amd64 (AppImage)',
          url: 'https://github.com/pluralplay/FlClashX/releases/latest/download/FlClashX-linux-amd64.AppImage',
        },
        {
          label: 'amd64 (.rpm)',
          url: 'https://github.com/pluralplay/FlClashX/releases/latest/download/FlClashX-linux-amd64.rpm',
        },
        {
          label: 'arm64 (.deb)',
          url: 'https://github.com/pluralplay/FlClashX/releases/latest/download/FlClashX-linux-arm64.deb',
        },
      ],
    },
    addSubscriptionDescription: 'Нажмите кнопку ниже, чтобы добавить подписку.',
    manualInstructions:
      'Если после нажатия на кнопку ничего не произошло, добавьте подписку вручную. Нажмите на этой странице кнопку «Получить ссылку» в правом верхнем углу, скопируйте ссылку. В FlClashX перейдите в раздел «Профили», нажмите кнопку «+», выберите URL, вставьте вашу скопированную ссылку и нажмите «Отправить».',
    connectInstructions:
      'Выберите добавленный профиль в разделе «Профили». В «Панели управления» нажмите кнопку «Включить» в правом нижнем углу, затем включите переключатель у пункта «TUN». После запуска в разделе «Прокси» вы можете изменить выбор сервера, к которому вас подключит.',
  },
  {
    id: 'koala',
    name: 'Koala Clash',
    Icon: Cat,
    // Популярен на Windows.
    recommendedOn: ['windows'],
    buildDeeplink: (sub) => `clash://install-config?url=${encodeURIComponent(sub)}`,
    stores: {
      macos: [{ label: 'Скачать (Global)', url: 'https://koalaclash.com' }],
      // iOS/Android пропущены: на мобильных показываем только INCY + Happ.
      windows: [{ label: 'Скачать (Global)', url: 'https://koalaclash.com' }],
      linux: [{ label: 'Скачать (Global)', url: 'https://koalaclash.com' }],
    },
    addSubscriptionDescription: 'Нажмите кнопку ниже, чтобы добавить подписку.',
    connectInstructions:
      'Откройте Koala Clash, выберите импортированный профиль и активируйте подключение. При необходимости выберите другой сервер в списке.',
  },
  {
    id: 'prizrak',
    name: 'Prizrak-Box',
    Icon: Ghost,
    // Популярен на Windows.
    recommendedOn: ['windows'],
    buildDeeplink: (sub) => `prizrak://import/${encodeURIComponent(sub)}`,
    stores: {
      macos: [{ label: 'Скачать (Global)', url: 'https://prizrak-box.com' }],
      // iOS/Android пропущены: на мобильных показываем только INCY + Happ.
      windows: [{ label: 'Скачать (Global)', url: 'https://prizrak-box.com' }],
      linux: [{ label: 'Скачать (Global)', url: 'https://prizrak-box.com' }],
    },
    addSubscriptionDescription: 'Нажмите кнопку ниже, чтобы добавить подписку.',
    connectInstructions:
      'Откройте Prizrak-Box, выберите импортированный профиль и активируйте подключение.',
  },
];

// Описание блока «Установка приложения». Зависит от платформы — на iOS
// есть специфика про разрешение VPN-конфигурации, поэтому отдельный текст.
// Возвращает defaultText если для платформы нет переопределения.
const INSTALL_DESCRIPTIONS: Partial<Record<PlatformId, string>> = {
  ios:
    'Откройте страницу в App Store и установите приложение. Запустите его, в окне разрешения VPN-конфигурации нажмите «Разрешить» и введите пароль.',
};
const INSTALL_DESCRIPTION_DEFAULT =
  'Выберите подходящую версию для вашего устройства, нажмите на кнопку ниже и установите приложение.';

// ─────────────────────────────────────────────────────────────
// Утилиты
// ─────────────────────────────────────────────────────────────

function detectPlatform(): PlatformId {
  if (typeof window === 'undefined') return 'macos';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  // android UA содержит "linux" — проверяем android раньше.
  if (/android/.test(ua)) return 'android';
  if (/mac/.test(ua)) return 'macos';
  if (/win/.test(ua)) return 'windows';
  if (/linux/.test(ua)) return 'linux';
  return 'macos';
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function Connect2Page() {
  const { status } = useAuth();
  const { hapticFeedback, webApp } = useTelegram();

  const [platform, setPlatform] = useState<PlatformId>('macos');
  const [platformOpen, setPlatformOpen] = useState(false);
  const [clientId, setClientId] = useState<ClientId>('happ');
  const [showQr, setShowQr] = useState(false);

  // Состояние блока «Твой ключ» / шапки QR / кнопки «Добавить подписку».
  // Единый source-of-truth — чтобы не размазывать `url/error/loading` по
  // трём отдельным state'ам и не делать строковых сравнений с error.
  const [sub, setSub] = useState<SubState>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);

  const subscriptionUrl = sub.kind === 'ok' ? sub.url : null;

  // Только клиенты, у которых есть store-ссылки на текущей платформе.
  // Сортировка: рекомендуемые для платформы — первыми, остальные сохраняют
  // порядок из `CLIENTS`. Stable-sort через `Array.prototype.sort` (V8/JSC
  // гарантируют стабильность с ES2019).
  //
  // Android-override: INCY идёт раньше Happ (продуктовое решение — дефолт
  // для Android, т.к. Happ рекомендуем на iOS/macOS, а на Android нам
  // удобнее вести юзеров на INCY).
  const visibleClients = useMemo(() => {
    const rank = (c: ClientDef): number => {
      if (platform === 'android') {
        if (c.id === 'incy') return 0;
        if (c.id === 'happ') return 1;
      }
      return c.recommendedOn?.includes(platform) ? 2 : 3;
    };
    return CLIENTS.filter((c) => (c.stores[platform]?.length ?? 0) > 0).sort(
      (a, b) => rank(a) - rank(b),
    );
  }, [platform]);

  const client = useMemo(
    () => visibleClients.find((c) => c.id === clientId) ?? visibleClients[0] ?? CLIENTS[0],
    [visibleClients, clientId],
  );

  // Если выбранный клиент не поддерживает текущую платформу —
  // авто-переключаем на первый доступный (например, при выборе Linux,
  // где Happ скрыт).
  useEffect(() => {
    if (!visibleClients.some((c) => c.id === clientId) && visibleClients[0]) {
      setClientId(visibleClients[0].id);
    }
  }, [visibleClients, clientId]);

  // Авто-детект платформы при первой загрузке. Заодно проставляем
  // дефолтный клиент: на Android — INCY (см. комментарий у visibleClients),
  // на остальных платформах — Happ как и было.
  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setClientId(p === 'android' ? 'incy' : 'happ');
  }, []);

  // Загрузка subscription URL. URL берём из ответа бэка (`subscription_url`,
  // строится в gateway из env PUBLIC_BASE_URL=https://cdn.osmonai.com).
  // На window.location.origin полагаться нельзя — Mini App может быть открыт
  // через 127.0.0.1:<port>, а Happ на телефоне до этого хоста не достучится.
  const fetchSubscription = useCallback(async () => {
    setSub({ kind: 'loading' });
    setCopied(false);
    try {
      const resp = await vpnApi.getSubscriptionToken();
      setSub({ kind: 'ok', url: resp.subscription_url });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setSub({ kind: 'no_subscription' });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setSub({ kind: 'error', message: msg });
    }
  }, []);

  // Загружаем один раз после успешной авторизации.
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
        const msg = err instanceof Error ? err.message : 'Ошибка';
        setSub({ kind: 'error', message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const handleCopySubscription = useCallback(async () => {
    if (sub.kind !== 'ok') return;
    try {
      await navigator.clipboard.writeText(sub.url);
      setCopied(true);
      hapticFeedback('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      hapticFeedback('error');
    }
  }, [sub, hapticFeedback]);

  /**
   * Открыть custom-URL схему из MiniApp. iOS-Telegram блокирует не-http(s)
   * схемы в SFSafariViewController — поэтому идём через /open?url=... в
   * внешнюю Safari, где `location.replace()` уже триггерит зарегистрированное
   * приложение. См. /open/page.tsx и connect/page.tsx::openDeeplink.
   */
  const openDeeplink = useCallback(
    (url: string) => {
      hapticFeedback('light');
      if (webApp?.openLink) {
        const redirect = `${window.location.origin}/open?url=${encodeURIComponent(url)}`;
        webApp.openLink(redirect);
        return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [hapticFeedback, webApp],
  );

  const handleAddSubscription = () => {
    if (!subscriptionUrl) return;
    openDeeplink(client.buildDeeplink(subscriptionUrl));
  };

  const downloads = client.stores[platform] ?? [];

  // Подбираем тексты с учётом per-platform переопределений (например,
  // Happ на Android показывает короткие подсказки вместо подробных).
  const platformOverrides = client.perPlatform?.[platform];
  const addSubscriptionDescription =
    platformOverrides?.addSubscriptionDescription ?? client.addSubscriptionDescription;
  const connectInstructions =
    platformOverrides?.connectInstructions ?? client.connectInstructions;
  const manualInstructions =
    platformOverrides?.manualInstructions ?? client.manualInstructions;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <header className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Назад"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <h1 className="text-lg font-semibold flex-1">Установка</h1>

          <button
            type="button"
            onClick={() => setShowQr(true)}
            disabled={!subscriptionUrl}
            aria-label="Получить ссылку (QR)"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <QrCode className="w-5 h-5" />
          </button>

          {/* Селектор платформы */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPlatformOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg px-3 h-9 text-sm font-medium border border-slate-700/50 bg-slate-800/80 hover:bg-slate-700/80 hover:border-slate-600/50 transition"
            >
              <span className="text-base leading-none">
                {PLATFORMS.find((p) => p.id === platform)?.icon}
              </span>
              <span>{PLATFORMS.find((p) => p.id === platform)?.label}</span>
              <ChevronDown className="w-4 h-4 opacity-60" />
            </button>

            {platformOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setPlatformOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-700/50 bg-slate-800 shadow-xl z-20 overflow-hidden">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPlatform(p.id);
                        setPlatformOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition ${
                        p.id === platform
                          ? 'text-cyan-400 bg-cyan-500/10'
                          : 'text-slate-100 hover:bg-slate-700/80'
                      }`}
                    >
                      <span className="text-base leading-none">{p.icon}</span>
                      <span>{p.label}</span>
                      {p.id === platform && (
                        <Check className="w-4 h-4 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>

        {/* ─── Блок 1: сетка клиентов ──────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3">
          {visibleClients.map((c) => {
            const selected = c.id === client.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setClientId(c.id)}
                className={`relative rounded-2xl px-4 py-3.5 text-left transition ${
                  selected
                    ? 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/40'
                    : 'border border-slate-700/50 bg-slate-800/80 text-slate-200 hover:border-slate-600/50 hover:bg-slate-700/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    {c.recommendedOn?.includes(platform) && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    )}
                    <span className="font-medium truncate">{c.name}</span>
                  </div>
                  <c.Icon className="ml-auto h-7 w-7 shrink-0 opacity-30" strokeWidth={2} />
                </div>
              </button>
            );
          })}
        </section>

        {/* ─── Блок 2: Установка приложения ────────────────────────── */}
        <Step
          icon={<Download size={22} strokeWidth={2} />}
          title="Установка приложения"
          description={INSTALL_DESCRIPTIONS[platform] ?? INSTALL_DESCRIPTION_DEFAULT}
          variant={platform === 'ios' ? 'violet' : 'cyan'}
        >
          {downloads.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {downloads.map((d) => (
                <a
                  key={d.url}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 px-4 py-2 text-sm font-medium transition"
                >
                  <span>{d.label}</span>
                  <ExternalLink className="w-4 h-4 opacity-80" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              Для этой платформы пока нет ссылки. Выберите другой клиент или платформу.
            </p>
          )}
        </Step>

        {/* ─── Блок 3: Добавление подписки ─────────────────────────── */}
        <Step
          icon={<CloudDownload size={22} strokeWidth={2} />}
          title="Добавление подписки"
          description={addSubscriptionDescription}
        >
          {sub.kind === 'no_subscription' ? (
            <p className="mt-3 text-sm text-amber-300/90">
              Нет активной подписки.{' '}
              <Link href="/plans" className="underline">
                Купить подписку
              </Link>
            </p>
          ) : sub.kind === 'error' ? (
            <p className="mt-3 text-sm text-rose-300/90">{sub.message}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAddSubscription}
                disabled={!subscriptionUrl}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium transition"
              >
                <Plus className="w-4 h-4" />
                Добавить подписку
              </button>
            </div>
          )}
        </Step>

        {/* ─── Блок 4: Если подписка не добавилась (опционально) ───── */}
        {manualInstructions && (
          <Step
            icon={<Settings size={22} strokeWidth={2} />}
            title="Если подписка не добавилась"
            description={manualInstructions}
          />
        )}

        {/* ─── Блок 5: Подключение и использование (emerald icon) ──── */}
        <Step
          icon={<Check size={22} strokeWidth={2} />}
          title="Подключение и использование"
          description={connectInstructions}
          variant="emerald"
        />

        {/* ─── Блок «Твой ключ» — QR + ссылка подписки ─────────────────
            Отдельный блок внизу страницы со ссылкой подписки
            (subscription_url) для импорта в любой клиент.                   */}
        <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              Твой ключ
            </h2>
            {sub.kind === 'ok' && (
              <button
                type="button"
                onClick={() => void fetchSubscription()}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                <RefreshCw className="w-3 h-3" /> обновить
              </button>
            )}
          </div>

          {sub.kind === 'loading' && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Запрашиваем ссылку подписки...
            </div>
          )}

          {sub.kind === 'no_subscription' && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
              <p className="text-sm text-amber-100">
                Нет активной подписки — купи тариф, чтобы получить ссылку для подключения.
              </p>
              <Link
                href="/plans"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-400/50 hover:bg-amber-400/10 text-amber-200 px-4 py-2 text-sm font-medium transition"
              >
                <CreditCard className="w-4 h-4" />
                Тарифы
              </Link>
            </div>
          )}

          {sub.kind === 'error' && (
            <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-4">
              <p className="text-sm text-rose-200 mb-3">{sub.message}</p>
              <button
                type="button"
                onClick={() => void fetchSubscription()}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 px-4 py-2 text-sm font-medium transition"
              >
                <RefreshCw className="w-4 h-4" /> Повторить
              </button>
            </div>
          )}

          {sub.kind === 'ok' && (
            <div className="space-y-4">
              {/* QR — клиенты (Happ/INCY/FlClashX/...) сами стянут полный
                  конфиг по этой ссылке и подхватят все сервера + актуальные
                  ключи Reality. */}
              <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-2">
                <QRCodeSVG value={sub.url} size={220} level="M" marginSize={2} />
                <p className="text-slate-700 text-xs text-center max-w-[220px]">
                  Наведи камеру или VPN-клиент на QR — он импортирует подписку сам.
                </p>
              </div>

              <details className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-3">
                <summary className="text-slate-400 text-xs cursor-pointer select-none">
                  Показать ссылку подписки
                </summary>
                <p className="mt-2 text-slate-200 text-xs font-mono break-all leading-relaxed">
                  {sub.url}
                </p>
              </details>

              <button
                type="button"
                onClick={() => void handleCopySubscription()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 px-4 py-3 text-sm font-medium transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Скопировано
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Скопировать ссылку
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ─── QR Modal ─────────────────────────────────────────────── */}
      {showQr && subscriptionUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setShowQr(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQr(false)}
              aria-label="Закрыть"
              className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-700/80 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-semibold mb-1 text-slate-100">QR-код подписки</h3>
            <p className="text-xs text-slate-400 mb-4">
              Отсканируйте VPN-клиентом или скопируйте ссылку для ручного импорта.
            </p>
            <div className="bg-white rounded-xl p-4 flex items-center justify-center mb-3">
              <QRCodeSVG value={subscriptionUrl} size={240} level="M" marginSize={2} />
            </div>
            <p className="text-[11px] text-slate-400 font-mono break-all">{subscriptionUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

/** Карточка-шаг (Block 2-5). По умолчанию — cyan; emerald для блока
 *  «Подключение и использование»; violet для блока «Установка» на iOS. */
function Step({
  icon,
  title,
  description,
  children,
  variant = 'cyan',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
  variant?: 'cyan' | 'emerald' | 'violet';
}) {
  const tileStyle =
    variant === 'emerald'
      ? { background: ICON_TILE_EMERALD_BG, border: ICON_TILE_EMERALD_BORDER }
      : variant === 'violet'
        ? { background: ICON_TILE_VIOLET_BG, border: ICON_TILE_VIOLET_BORDER }
        : { background: ICON_TILE_CYAN_BG, border: ICON_TILE_CYAN_BORDER };
  const iconColor =
    variant === 'emerald'
      ? 'text-emerald-400'
      : variant === 'violet'
        ? 'text-violet-400'
        : 'text-cyan-400';

  return (
    <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className={`shrink-0 flex items-center justify-center rounded-full ${iconColor}`}
          style={{ width: 44, height: 44, ...tileStyle }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-100">{title}</h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-400">
            {description}
          </p>
          {children}
        </div>
      </div>
    </section>
  );
}
