import { fetchSignals } from './src/signals';
import { getAgentVotes, getConsensus } from './src/brain';

async function main() {
  const signals = await fetchSignals();
  console.log('--- SIGNALS ---');
  console.log(signals);

  console.log('\n--- BRAIN ---');
  const votes = await getAgentVotes(signals);
  const consensus = getConsensus(votes);
  console.log('BULL:', votes.bull);
  console.log('BEAR:', votes.bear);
  console.log('ZEN:', votes.zen);
  console.log('CONSENSUS:', consensus);
}

main().catch(console.error);
