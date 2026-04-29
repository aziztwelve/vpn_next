'use client';

// ─────────────────────────────────────────────────────────────────
// Реферальная программа.
//
//   GET /referral/link   — токен/URL текущего юзера (создаётся идемпотентно)
//   GET /referral/stats  — счётчики (приглашено / купили / дни / баланс)
//   POST/GET /referral/withdrawal[s] — для role='partner' (заявки на вывод)
//
// Для обычного юзера (role='user') показываем:
//   • реферальную ссылку с кнопками «Поделиться» / «Скопировать»
//   • сколько друзей пришло, сколько дней начислено
//   • объяснение «приведи друга → +N дней обоим»
//
// Для партнёра (role='partner') дополнительно:
//   • текущий баланс ₽
//   • история заявок на вывод
//   • форма создания новой заявки
//
// MainButton Telegram'а сейчас не используем — у нас полноразмерные кнопки
// внутри страницы, чтобы UX совпадал с остальными разделами Mini App.
// ─────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Share2, Users, Gift, Wallet, Loader2 } from 'lucide-react';

import { ApiError, vpnApi } from '@/lib/api';
import type { ReferralLink, ReferralStats, WithdrawalRequest } from '@/lib/referral';
import { useAuth } from '@/lib/auth-context';
import { useTelegram } from '@/lib/useTelegram';
import { formatPrice, pluralize } from '@/lib/format';

export default function ReferralPage() {
  const { status: authStatus, user, error: authError } = useAuth();
  const { webApp, hapticFeedback, showAlert } = useTelegram();

  const [link, setLink] = useState<ReferralLink | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isPartner = user?.role === 'partner';

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Реквесты в параллель — link/stats независимы. Withdrawals только для
      // partner'а (для user'а 403 не падает, бэк просто вернёт пустой список,
      // но лишний реквест экономим).
      const [linkResp, statsResp, withdrawalsResp] = await Promise.all([
        vpnApi.getReferralLink(),
        vpnApi.getReferralStats(),
        isPartner ? vpnApi.listWithdrawals() : Promise.resolve(null),
      ]);
      setLink(linkResp);
      setStats(statsResp);
      if (withdrawalsResp) setWithdrawals(withdrawalsResp.requests);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status}: ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Ошибка загрузки';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isPartner]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    void loadAll();
  }, [authStatus, loadAll]);

  // Копирование ссылки в буфер обмена. На iOS внутри Telegram WebApp
  // navigator.clipboard может быть недоступен — fallback на execCommand.
  const copyLink = useCallback(async () => {
    if (!link) return;
    hapticFeedback('light');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link.url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = link.url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      hapticFeedback('success');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showAlert('Не удалось скопировать. Скопируй вручную.');
    }
  }, [link, hapticFeedback, showAlert]);

  // Шейр через Telegram. Используем openTelegramLink('https://t.me/share/url?...').
  // Это надёжнее switchInlineQuery, который требует inline-бот в @BotFather.
  const shareLink = useCallback(() => {
    if (!link || !webApp) return;
    hapticFeedback('medium');
    const text = encodeURIComponent(
      'Подписывайся на наш VPN — быстро, без логов, без рекламы. Пробный период бесплатно по моей ссылке:',
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link.url)}&text=${text}`;
    webApp.openTelegramLink(shareUrl);
  }, [link, webApp, hapticFeedback]);

  if (authStatus === 'loading' || loading) {
    return <Loader label="Загрузка..." />;
  }
  if (authStatus !== 'authenticated') {
    return (
      <ErrorScreen message={authError ?? 'Нужна авторизация через Telegram.'}>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 inline-block">
          На главную
        </Link>
      </ErrorScreen>
    );
  }
  if (error) {
    return (
      <ErrorScreen message={error}>
        <button
          onClick={() => void loadAll()}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3"
        >
          Повторить
        </button>
      </ErrorScreen>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Назад" className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold">Пригласить друга</h1>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed">
          Поделись ссылкой — друг получит {isPartner ? 'пробный период,' : '+3 дня к подписке,'}
          {isPartner ? (
            <>
              {' '}а тебе вернётся <span className="text-emerald-300">30%</span> с его первой оплаты на твой баланс ₽.
            </>
          ) : (
            ' а ты получишь +3 дня к своей.'
          )}
        </p>

        {/* Реферальная ссылка + кнопки */}
        {link && (
          <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 space-y-3">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Твоя ссылка</div>
            <div className="bg-slate-900/70 rounded-lg px-3 py-2 text-sm break-all font-mono text-slate-200 select-all">
              {link.url}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void copyLink()}
                className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-700/80 text-white rounded-lg px-4 py-3 text-sm font-medium transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Скопировано!' : 'Скопировать'}
              </button>
              <button
                onClick={shareLink}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg px-4 py-3 text-sm font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Поделиться
              </button>
            </div>
            <div className="text-xs text-slate-500">
              Кликов по ссылке: {link.click_count}
            </div>
          </section>
        )}

        {/* Статистика */}
        {stats && <StatsBlock stats={stats} isPartner={isPartner} />}

        {/* Партнёрская секция: вывод средств */}
        {isPartner && stats && (
          <PartnerWithdrawalSection
            currentBalance={stats.current_balance_rub}
            withdrawals={withdrawals}
            onCreated={() => void loadAll()}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Stats
// ──────────────────────────────────────────────────────────────────

function StatsBlock({ stats, isPartner }: { stats: ReferralStats; isPartner: boolean }) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <StatCard
        icon={<Users className="w-5 h-5 text-cyan-400" />}
        label="Приглашено"
        value={`${stats.invited_count} ${pluralize(stats.invited_count, ['друг', 'друга', 'друзей'])}`}
        sub={
          stats.purchased_count > 0
            ? `${stats.purchased_count} с оплатой`
            : 'из них с оплатой: 0'
        }
      />
      <StatCard
        icon={<Gift className="w-5 h-5 text-emerald-400" />}
        label="Бонусные дни"
        value={`+${stats.rewarded_days_total}`}
        sub={pluralize(stats.rewarded_days_total, ['день', 'дня', 'дней'])}
      />
      {isPartner && (
        <>
          <StatCard
            icon={<Wallet className="w-5 h-5 text-emerald-400" />}
            label="Баланс"
            value={formatPrice(stats.current_balance_rub)}
            sub="доступно к выводу"
          />
          <StatCard
            icon={<Wallet className="w-5 h-5 text-slate-400" />}
            label="Всего заработано"
            value={formatPrice(stats.earned_balance_rub_total)}
            sub={
              stats.pending_count > 0
                ? `${stats.pending_count} в обработке`
                : 'за всё время'
            }
          />
        </>
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Partner withdrawal
// ──────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'card_ru', label: 'Карта РФ' },
  { value: 'sbp', label: 'СБП' },
  { value: 'usdt_trc20', label: 'USDT (TRC-20)' },
] as const;

type WithdrawalErrorCode =
  | 'insufficient_balance'
  | 'not_partner'
  | 'amount_too_small'
  | 'invalid_method'
  | string;

function withdrawalErrorMessage(code: WithdrawalErrorCode): string {
  switch (code) {
    case 'insufficient_balance':
      return 'Недостаточно средств на балансе.';
    case 'not_partner':
      return 'Вывод доступен только для партнёров.';
    case 'amount_too_small':
      return 'Сумма меньше минимально допустимой.';
    case 'invalid_method':
      return 'Неподдерживаемый способ выплаты.';
    default:
      return code || 'Неизвестная ошибка';
  }
}

function PartnerWithdrawalSection({
  currentBalance,
  withdrawals,
  onCreated,
}: {
  currentBalance: string;
  withdrawals: WithdrawalRequest[];
  onCreated: () => void;
}) {
  const { hapticFeedback } = useTelegram();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<typeof PAYMENT_METHODS[number]['value']>('card_ru');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState(false);

  // Поле «реквизиты»: для каждого метода один смысл, пихаем в payment_details
  // под одним фиксированным ключом — бэк понимает.
  const detailsKey = method === 'usdt_trc20' ? 'wallet' : 'account';
  const detailsPlaceholder =
    method === 'usdt_trc20'
      ? 'TRON-адрес (T...)'
      : method === 'sbp'
        ? 'Телефон +7...'
        : 'Номер карты';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormOk(false);

    if (!amount || Number(amount) <= 0) {
      setFormError('Укажи сумму больше 0.');
      return;
    }
    if (!details.trim()) {
      setFormError('Укажи реквизиты для выплаты.');
      return;
    }

    setSubmitting(true);
    hapticFeedback('medium');
    try {
      const resp = await vpnApi.createWithdrawalRequest(amount, method, {
        [detailsKey]: details.trim(),
      });
      if ('error' in resp) {
        setFormError(withdrawalErrorMessage(resp.error));
        hapticFeedback('error');
      } else {
        setFormOk(true);
        setAmount('');
        setDetails('');
        hapticFeedback('success');
        onCreated();
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? withdrawalErrorMessage(err.code ?? err.message)
          : err instanceof Error
            ? err.message
            : 'Ошибка отправки';
      setFormError(msg);
      hapticFeedback('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Вывод средств</h2>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 space-y-3"
      >
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Сумма ₽ (доступно: {formatPrice(currentBalance)})
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Способ выплаты</label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${
                  method === m.value
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Реквизиты</label>
          <input
            type="text"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={detailsPlaceholder}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {formError && <div className="text-xs text-red-400">{formError}</div>}
        {formOk && (
          <div className="text-xs text-emerald-300">Заявка создана. Обработаем в течение 1–3 рабочих дней.</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Запросить вывод
        </button>
      </form>

      {withdrawals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs text-slate-400 uppercase tracking-wider">История заявок</h3>
          {withdrawals.map((w) => (
            <WithdrawalRow key={w.id} w={w} />
          ))}
        </div>
      )}
    </section>
  );
}

function WithdrawalRow({ w }: { w: WithdrawalRequest }) {
  const badge = withdrawalBadge(w.status);
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{formatPrice(w.amount_rub)}</div>
        <div className="text-xs text-slate-400 truncate">
          {w.payment_method} · {new Date(w.created_at).toLocaleDateString('ru-RU')}
        </div>
        {w.admin_comment && (
          <div className="text-xs text-slate-500 mt-1 italic">{w.admin_comment}</div>
        )}
      </div>
      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${badge.className}`}>
        {badge.label}
      </span>
    </div>
  );
}

function withdrawalBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'pending':
      return { label: 'В обработке', className: 'bg-yellow-500/20 text-yellow-300' };
    case 'approved':
      return { label: 'Одобрена', className: 'bg-blue-500/20 text-blue-300' };
    case 'paid':
      return { label: 'Выплачено', className: 'bg-emerald-500/20 text-emerald-300' };
    case 'rejected':
      return { label: 'Отклонена', className: 'bg-red-500/20 text-red-300' };
    default:
      return { label: status, className: 'bg-slate-700 text-slate-300' };
  }
}

// ──────────────────────────────────────────────────────────────────
// shared screens
// ──────────────────────────────────────────────────────────────────

function Loader({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin h-10 w-10 text-blue-400 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">{label}</p>
      </div>
    </div>
  );
}

function ErrorScreen({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-red-400 mb-4 text-sm">{message}</p>
        {children}
      </div>
    </div>
  );
}
