import { Connection, PublicKey } from "@solana/web3.js";
import { deriveAgentReputationPda } from "./pda";
import { Reader } from "./reader";
import type { AgentReputation } from "./types";

export function decodeAgentReputation(
  pubkey: PublicKey,
  data: Buffer
): AgentReputation | null {
  try {
    const r = new Reader(data);
    r.skip(8);
    const vault = r.publicKey();
    const bullCorrect = r.u32();
    const bullTotal = r.u32();
    const bearCorrect = r.u32();
    const bearTotal = r.u32();
    const zenCorrect = r.u32();
    const zenTotal = r.u32();
    const lastUpdated = Number(r.i64());
    return {
      pubkey,
      vault,
      bullCorrect,
      bullTotal,
      bearCorrect,
      bearTotal,
      zenCorrect,
      zenTotal,
      lastUpdated,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the per-agent reputation account for a vault. Returns null when
 * the PDA doesn't exist yet — the Fornex agent runtime gracefully handles
 * this by treating it as a no-op until the admin runs `init_agent_reputation`.
 */
export async function getAgentReputation(
  connection: Connection,
  programId: PublicKey,
  vault: PublicKey
): Promise<AgentReputation | null> {
  const [pda] = deriveAgentReputationPda(programId, vault);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return decodeAgentReputation(pda, Buffer.from(info.data));
}
