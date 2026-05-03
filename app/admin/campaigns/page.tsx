'use client';

// ─────────────────────────────────────────────────────────────────
// Список маркетинговых воронок (кампаний).
//
// Админская страница: таблица с базовыми метриками по каждой воронке
// (/start → open → trial → paid → revenue) и кнопкой создать новую.
// Клик по строке ведёт на /admin/campaigns/[id] с детальной воронкой.
// ─────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Loader2, AlertTriangle, Archive, Copy } from 'lucide-react';

import { ApiError, vpnApi } from '@/lib/api';
import type { CampaignWithStats } from '@/lib/campaign';
import { formatRub } from '@/lib/campaign';
import { useTelegram } from '@/lib/useTelegram';

export default function AdminCampaignsPage() {
  const { hapticFeedback } = useTelegram();
  const [items, setItems] = useState<CampaignWithStats[] | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await vpnApi.listCampaigns(includeArchived);
      setItems(resp.campaigns);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Не удалось загрузить список кампаний';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка при монтировании/смене фильтра
    void load();
  }, [load]);

  const copyLink = useCallback(
    async (link: string) => {
      try {
        await navigator.clipboard.writeText(link);
        hapticFeedback?.('success');
      } catch {
        // ignore
      }
    },
    [hapticFeedback],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <Link
          href="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-xl font-semibold">Воронки</h1>
        <Link
          href="/admin/campaigns/new"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Создать
        </Link>
      </header>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => setIncludeArchived(e.target.checked)}
        />
        Показывать архивированные
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {loading && !items && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Пока нет кампаний. Создайте первую — и отдайте deep-link блогеру.
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map(({ campaign, stats }) => (
            <li
              key={campaign.id}
              className="rounded-lg border bg-card p-4 hover:border-primary/40"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/campaigns/${campaign.id}`}
                    className="block text-base font-medium hover:underline"
                  >
                    {campaign.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                      {campaign.slug}
                    </code>
                    {!campaign.is_active && (
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                        <Archive className="h-3 w-3" />
                        архив
                      </span>
                    )}
                    {campaign.payout_percent > 0 && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                        {campaign.payout_percent}% партнёру
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyLink(campaign.deep_link)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted"
                  title="Скопировать deep-link"
                >
                  <Copy className="h-3 w-3" />
                  Ссылка
                </button>
              </div>

              <dl className="grid grid-cols-5 gap-2 text-xs">
                <Stat label="Старт" value={stats.starts} />
                <Stat label="Открыли" value={stats.opened_app} />
                <Stat label="Подписка" value={stats.trial_activated} />
                <Stat label="Оплата" value={stats.paid_users} />
                <Stat label="Revenue" value={formatRub(stats.revenue_rub)} />
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded bg-muted/50 p-2">
      <dt className="text-[10px] uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
