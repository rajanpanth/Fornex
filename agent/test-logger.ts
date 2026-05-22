import { logDecisionOnChain, updateNavOnChain } from './src/logger';
import { getAgentVotes, getConsensus } from './src/brain';
import { fetchSignals } from './src/signals';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

async function main() {
  console.log('Testing logger module...');
  
  const signals = await fetchSignals();
  const votes = await getAgentVotes(signals, "NONE");
  const consensus = getConsensus(votes);
  
  console.log('\n--- 1. Testing updateNavOnChain ---');
  // Update NAV to 100 SOL for testing
  const navLamports = 100 * LAMPORTS_PER_SOL;
  const navSig = await updateNavOnChain(navLamports);
  console.log('NAV updated successfully:', navSig);

  console.log('\n--- 2. Testing logDecisionOnChain ---');
  // Mock an execution signature
  const mockExecutionSig = 'test_execution_signature_123';
  const logSig = await logDecisionOnChain(votes, consensus, true, mockExecutionSig);
  console.log('Decision logged successfully:', logSig);
  
  console.log('\nLogger test complete!');
}

main().catch(console.error);
