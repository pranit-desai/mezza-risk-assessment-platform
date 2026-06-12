import ScoringBandsPageClient from './ScoringBandsPageClient';
import { loadScoringPolicyBundle } from '@/lib/scoringPolicyStore';

export const dynamic = 'force-dynamic';

export default async function ScoringBandsPage() {
  const bundle = await loadScoringPolicyBundle();

  return (
    <ScoringBandsPageClient
      initialPolicies={bundle.policies}
      initialSetupRequired={bundle.setupRequired}
      initialErrors={bundle.errors}
      initialPasswordConfigured={Boolean(process.env.SCORING_BANDS_PASSWORD || process.env.SCORING_BANDS_PASSWORD_SHA256)}
    />
  );
}
