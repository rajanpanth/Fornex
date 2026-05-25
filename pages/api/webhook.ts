import type { NextApiRequest, NextApiResponse } from "next";
import { pushFornexEvents } from "./events";

const PROGRAM_ID =
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
  "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf";

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
    const accounts = [
      ...(event.accountData || []),
      ...(event.accounts || []),
      ...(event.nativeTransfers || []),
    ];
    return (
      event.source === "FORNEX" ||
      event.description?.includes(PROGRAM_ID) ||
      accounts.some((account: any) => {
        const address = account.account || account.accountAddress || account;
        return address === PROGRAM_ID;
      })
    );
  });

  if (decisions.length > 0) pushFornexEvents(decisions);
  return res.status(200).json({ received: true, matched: decisions.length });
}
