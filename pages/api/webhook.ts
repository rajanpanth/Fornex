import type { NextApiRequest, NextApiResponse } from "next";
import { pushFornexEvents } from "./events";

const PROGRAM_ID =
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
  "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf";

const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET || "";

/**
 * Broad match: checks if the program ID appears anywhere in the event payload.
 * Helius enhanced webhook payloads vary — the program ID may appear in
 * accountData[].account, instructions[].programId, raw account keys, etc.
 * Using JSON string matching ensures we catch all variants reliably.
 */
function eventMentionsProgram(event: any, programId: string): boolean {
  const json = JSON.stringify(event);
  return json.includes(programId);
}

/**
 * Sanitize an inbound event so SSE clients only receive whitelisted fields.
 * Prevents arbitrary HTML/JS strings from a malicious or compromised webhook
 * source from being broadcast to browser subscribers.
 */
function sanitize(event: any): {
  signature: string;
  type: string;
  timestamp: number;
  programId: string;
} {
  return {
    signature: String(event?.signature ?? "").slice(0, 96).replace(/[^A-Za-z0-9]/g, ""),
    type: String(event?.type ?? "").slice(0, 64).replace(/[^A-Za-z0-9_-]/g, ""),
    timestamp: Number.isFinite(event?.timestamp) ? Number(event.timestamp) : Date.now(),
    programId: PROGRAM_ID,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Authenticate the webhook. Helius supports a per-webhook authorization
  // header; we expect "Bearer <secret>". If HELIUS_WEBHOOK_SECRET is unset
  // we keep the endpoint open (devnet/local development) but log a warning.
  if (WEBHOOK_SECRET) {
    const got = req.headers["authorization"] || req.headers["Authorization"];
    if (got !== `Bearer ${WEBHOOK_SECRET}` && got !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  } else {
    console.warn("[webhook] HELIUS_WEBHOOK_SECRET unset; accepting unauthenticated events");
  }

  const events = Array.isArray(req.body) ? req.body : [req.body];
  const decisions = events.filter((event: any) => {
    const accounts = [
      ...(event.accountData || []),
      ...(event.accounts || []),
      ...(event.nativeTransfers || []),
    ];
    const specificMatch =
      event.source === "FORNEX" ||
      event.description?.includes(PROGRAM_ID) ||
      accounts.some((account: any) => {
        const address = account.account || account.accountAddress || account;
        return address === PROGRAM_ID;
      });
    return specificMatch || eventMentionsProgram(event, PROGRAM_ID);
  });

  if (decisions.length > 0) {
    pushFornexEvents(decisions.map(sanitize));
  }
  return res.status(200).json({ received: true, matched: decisions.length });
}
