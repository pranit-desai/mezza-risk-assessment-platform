import SeasonalityPageClient from './SeasonalityPageClient';
import { loadSeasonalityBundle } from '@/lib/seasonalityStore';

export const dynamic = 'force-dynamic';

export default async function SeasonalityPage() {
  const bundle = await loadSeasonalityBundle();
  return <SeasonalityPageClient initialBundle={bundle} />;
}
