'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CampaignForm, {
  emptyValues,
  valuesFrom,
  type CampaignFormValues,
} from '@/components/admin/CampaignForm';
import { adminApi } from '@/lib/admin';
import { useFeedback } from '@/components/ui/feedback';

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error } = useFeedback();
  const [initial, setInitial] = useState<CampaignFormValues | null>(null);
  const [counts, setCounts] = useState<Partial<Record<string, number>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const campaign = await adminApi.getCampaign(id);
        if (!cancelled) {
          setInitial(valuesFrom(campaign));
          setCounts(campaign.counts ?? {});
        }
      } catch (e) {
        if (!cancelled) {
          error(e instanceof Error ? e.message : 'Could not load this campaign.');
          setInitial(emptyValues());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, error]);

  if (!initial) {
    return (
      <main className="px-5 py-7 sm:px-8">
        <p className="text-sm text-[var(--sf-muted)]">Loading campaign…</p>
      </main>
    );
  }

  return (
    <CampaignForm
      mode="edit"
      initial={initial}
      counts={counts}
      backHref={`/admin/campaigns/${id}`}
      onSubmit={async (payload) => {
        await adminApi.updateCampaign(id, payload);
        success('Saved.');
        router.push(`/admin/campaigns/${id}`);
      }}
    />
  );
}
