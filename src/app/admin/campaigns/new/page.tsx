'use client';

import { useRouter } from 'next/navigation';
import CampaignForm, { emptyValues } from '@/components/admin/CampaignForm';
import { adminApi } from '@/lib/admin';
import { useFeedback } from '@/components/ui/feedback';

/**
 * Create a campaign.
 *
 * Its own page rather than a panel on the list: this is where the job
 * description is pasted and the questions are written, which is the longest
 * single piece of writing anyone does in the admin surface. A dialog would fight
 * it — and losing a half-written JD to a stray click outside a modal is exactly
 * the kind of loss that makes people stop using an internal tool.
 */
export default function NewCampaignPage() {
  const router = useRouter();
  const { success } = useFeedback();

  return (
    <CampaignForm
      mode="create"
      initial={emptyValues()}
      backHref="/admin/campaigns"
      onSubmit={async (payload) => {
        const campaign = await adminApi.createCampaign(payload);
        success(`Created as a draft. Its apply page will be /apply/${campaign.slug}`);
        router.push(`/admin/campaigns/${campaign.id}`);
      }}
    />
  );
}
