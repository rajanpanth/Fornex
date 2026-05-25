import type { NextApiRequest, NextApiResponse } from "next";
import { pushFornexEvents } from "./events";

const PROGRAM_ID =
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
  "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf";

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const events = Array.isArray(req.body) ? req.body : [req.body];
  const decisions = events.filter((event: any) => {
    // Specific structural checks first
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
    // Broad fallback: match program ID anywhere in the payload
    return specificMatch || eventMentionsProgram(event, PROGRAM_ID);
  });

  if (decisions.length > 0) pushFornexEvents(decisions);
  return res.status(200).json({ received: true, matched: decisions.length });
}
