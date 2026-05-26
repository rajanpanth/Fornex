import type { NextApiRequest, NextApiResponse } from "next";
import { Connection } from "@solana/web3.js";
import {
  DECISION_ACCOUNT_SIZE,
  LEGACY_DECISION_ACCOUNT_SIZE,
  PROGRAM_ID,
  RPC_URL,
  decodeDecision,
} from "../../lib/chain";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const currentAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: DECISION_ACCOUNT_SIZE }],
    });
    const legacyAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: LEGACY_DECISION_ACCOUNT_SIZE }],
    });

    const decisions = [...currentAccounts, ...legacyAccounts]
      .map((account) => decodeDecision(account.pubkey, account.account.data))
      .filter(Boolean)
      .sort((a, b) => b!.decisionIndex - a!.decisionIndex)
      .slice(0, 12)
      .map((decision) => ({
        ...decision!,
        pubkey: decision!.pubkey.toBase58(),
      }));

    res.status(200).json({ decisions });
  } catch (error: any) {
    console.error("[fornex] /api/decisions failed:", error);
    res.status(500).json({ error: error?.message || "Failed to load decisions" });
  }
}
