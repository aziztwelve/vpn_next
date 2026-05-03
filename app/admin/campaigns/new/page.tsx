'use client';

// ─────────────────────────────────────────────────────────────────
// Форма создания новой маркетинговой воронки (кампании).
//
// Поля:
//   slug — уникальный идентификатор в URL (ivan_jan2026, regex CAMPAIGN_SLUG_RE)
//   name — человекочитаемое название
//   notes — свободный текст (откуда, когда, комментарии)
//   partner_user_id — опционально, ID юзера-получателя %
//   payout_percent — опционально, 0..50
//
// payout требует partner'а — проверяем на фронте до отправки.
// Бэкенд дублирует валидацию (service + БД CHECK).
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';

import { ApiError, vpnApi } from '@/lib/api';
import { CAMPAIGN_SLUG_RE, CAMPAIGN_MAX_PAYOUT_PERCENT } from '@/lib/campaign';

export default function NewCampaignPage() {
  const router = useRouter();

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [partnerID, setPartnerID] = useState('');
  const [payout, setPayout] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugOK = slug === '' || CAMPAIGN_SLUG_RE.test(slug);
  const payoutNum = payout === '' ? 0 : Number(payout);
  const partnerNum = partnerID === '' ? 0 : Number(partnerID);
  const payoutOK =
    payout === '' ||
    (Number.isInteger(payoutNum) && payoutNum >= 0 && payoutNum <= CAMPAIGN_MAX_PAYOUT_PERCENT);
  const payoutRequiresPartner = payoutNum > 0 && partnerNum <= 0;

  const canSubmit =
    slug !== '' && name !== '' && slugOK && payoutOK && !payoutRequiresPartner && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await vpnApi.createCampaign({
        slug,
        name,
        notes: notes || undefined,
        partner_user_id: partnerNum > 0 ? partnerNum : undefined,
        payout_percent: payoutNum > 0 ? payoutNum : undefined,
      });
      router.replace(`/admin/campaigns/${resp.campaign.id}`);
    } catch (err) {
      let msg = 'Не удалось создать кампанию';
      if (err instanceof ApiError) {
        // На конфликте slug'а бэкенд отдаёт 409; показываем понятный текст.
        if (err.status === 409) msg = 'Такой slug уже занят — придумайте другой';
        else msg = err.message || msg;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-4">
      <header className="mb-4 flex items-center gap-2">
        <Link
          href="/admin/campaigns"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">Новая воронка</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Slug"
          hint="Попадёт в URL: https://t.me/<bot>?start=src_<slug>. Только [a-z0-9_-], длина 3–60."
          error={!slugOK ? 'Формат: [a-z0-9_-]{3,60}' : undefined}
        >
          <input
            type="text"
            autoComplete="off"
            value={slug}
            onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
            placeholder="ivan_jan2026"
            className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
            required
          />
        </Field>

        <Field label="Название" hint="Отображается в списке для себя.">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иван, канал Январь 2026"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            required
          />
        </Field>

        <Field label="Заметки" hint="Опционально: договорённости, цена размещения, дата.">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </Field>

        <Field
          label="Партнёр (user_id)"
          hint="Опционально. Юзер, на баланс которого будут начисляться %."
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={partnerID}
            onChange={(e) => setPartnerID(e.target.value)}
            placeholder="0 = без партнёра"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm tabular-nums"
          />
        </Field>

        <Field
          label={`Процент выплат (0..${CAMPAIGN_MAX_PAYOUT_PERCENT}%)`}
          hint="Опционально. С каждой оплаты реферала — % на баланс партнёра."
          error={!payoutOK ? `0..${CAMPAIGN_MAX_PAYOUT_PERCENT}` : payoutRequiresPartner ? 'Нельзя задать % без партнёра' : undefined}
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={CAMPAIGN_MAX_PAYOUT_PERCENT}
            value={payout}
            onChange={(e) => setPayout(e.target.value)}
            placeholder="0 = без выплат"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm tabular-nums"
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Link
            href="/admin/campaigns"
            className="flex-1 rounded-md border px-4 py-2 text-center text-sm hover:bg-muted"
          >
            Отмена
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
