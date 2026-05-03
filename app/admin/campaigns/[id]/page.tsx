'use client';

// ─────────────────────────────────────────────────────────────────
// Детальная страница кампании.
//
// Показывает:
//   • deep-link c кнопкой «Скопировать»
//   • воронку (5 шагов) с процентами конверсии
//   • revenue и выплаты партнёру
//   • фильтр by period (from/to)
//   • кнопку «Архивировать» (soft-delete)
//
// Next.js 16: params — Promise, разворачиваем через React.use().
// ─────────────────────────────────────────────────────────────────

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Archive,
  Loader2,
  AlertTriangle,
  Check,
} from 'lucide-react';

import { ApiError, vpnApi } from '@/lib/api';
import type { Campaign, CampaignStats } from '@/lib/campaign';
import { buildFunnel, formatRub } from '@/lib/campaign';
import { useTelegram } from '@/lib/useTelegram';

interface Props {
  params: Promise<{ id: string }>;
}

export default function CampaignDetailPage({ params }: Props) {
  const { id: idRaw } = use(params);
  const id = Number(idRaw);
  const { hapticFeedback, showConfirm } = useTelegram();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Период — локальный стейт, отдельно от кампании (кампания не меняется при смене фильтра).
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [copied, setCopied] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const fromISO = from ? new Date(from).toISOString() : undefined;
      const toISO = to ? new Date(to).toISOString() : undefined;
      const resp = await vpnApi.getCampaign(id, fromISO, toISO);
      setCampaign(resp.campaign);
      setStats(resp.stats);
    } catch (err) {
      let msg = 'Не удалось загрузить кампанию';
      if (err instanceof ApiError) {
        if (err.status === 404) msg = 'Кампания не найдена';
        else msg = err.message || msg;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка при монтировании/смене фильтра
    void load();
  }, [load]);

  const funnel = useMemo(() => (stats ? buildFunnel(stats) : []), [stats]);

  const copyLink = useCallback(async () => {
    if (!campaign) return;
    try {
      await navigator.clipboard.writeText(campaign.deep_link);
      setCopied(true);
      hapticFeedback?.('success');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [campaign, hapticFeedback]);

  const doArchive = useCallback(async () => {
    if (!campaign) return;
    setArchiving(true);
    try {
      const resp = await vpnApi.archiveCampaign(campaign.id);
      setCampaign(resp.campaign);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось архивировать');
    } finally {
      setArchiving(false);
    }
  }, [campaign]);

  const handleArchive = useCallback(() => {
    if (!campaign) return;
    const msg = `Архивировать воронку «${campaign.name}»?\n\nСтарая статистика останется, но новые /start больше не атрибутируются.`;
    if (showConfirm) {
      showConfirm(msg, (ok) => {
        if (ok) void doArchive();
      });
    } else if (window.confirm(msg)) {
      void doArchive();
    }
  }, [campaign, showConfirm, doArchive]);

  if (!Number.isFinite(id) || id <= 0) {
    return <div className="p-4 text-sm text-destructive">Неверный идентификатор</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <Link
          href="/admin/campaigns"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-xl font-semibold truncate">
          {campaign?.name || `Воронка #${id}`}
        </h1>
        {campaign && campaign.is_active && (
          <button
            type="button"
            onClick={handleArchive}
            disabled={archiving}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {archiving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Архив
          </button>
        )}
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {loading && !campaign && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {campaign && (
        <>
          {/* Мета-данные кампании */}
          <section className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                {campaign.slug}
              </code>
              {!campaign.is_active && (
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                  <Archive className="h-3 w-3" />
                  архивирована
                </span>
              )}
              {campaign.payout_percent > 0 && campaign.partner_user_id > 0 && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {campaign.payout_percent}% → user #{campaign.partner_user_id}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-md border bg-background p-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                {campaign.deep_link}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" /> Скопировано
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Копировать
                  </>
                )}
              </button>
            </div>

            {campaign.notes && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {campaign.notes}
              </p>
            )}
          </section>

          {/* Фильтр по периоду */}
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">Период</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">С</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">По</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5"
                />
              </label>
            </div>
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  setFrom('');
                  setTo('');
                }}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Сбросить фильтр
              </button>
            )}
          </section>

          {/* Воронка */}
          {stats && (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="mb-3 text-sm font-medium">Воронка</h2>
              <ul className="space-y-2">
                {funnel.map((step, i) => (
                  <li key={step.label} className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm">{step.label}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {step.count}
                    </span>
                    {step.conversion !== null && (
                      <span className="min-w-[3.5rem] text-right text-xs text-muted-foreground tabular-nums">
                        {step.conversion}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <dl className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Revenue</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatRub(stats.revenue_rub)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Выплачено партнёру</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatRub(stats.partner_payouts_rub)}
                  </dd>
                </div>
              </dl>
            </section>
          )}
        </>
      )}
    </div>
  );
}
