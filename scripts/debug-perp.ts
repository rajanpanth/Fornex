import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

async function main() {
  const drift = await import("@drift-labs/sdk");
  const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const sk = bs58.decode(process.env.AGENT_KEYPAIR!);
  const kp = Keypair.fromSecretKey(sk);

  const wallet = {
    publicKey: kp.publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };

  const accountLoader = new (drift as any).BulkAccountLoader(conn, "confirmed", 1000);
  const client = new (drift as any).DriftClient({
    connection: conn,
    wallet,
    env: "devnet",
    perpMarketIndexes: [0],
    spotMarketIndexes: [0, 1],
    accountSubscription: { type: "polling", accountLoader },
  });
  await client.subscribe();
  await new Promise((r) => setTimeout(r, 5000));
  await accountLoader.load();

  const perp0 = client.getPerpMarketAccount?.(0);
  const spot0 = client.getSpotMarketAccount?.(0);
  console.log("Perp market 0:", perp0?.pubkey?.toBase58?.(), "name:", perp0 ? Buffer.from(perp0.name || []).toString("utf8").trim() : "n/a");
  console.log("Spot market 0:", spot0?.pubkey?.toBase58?.());
  console.log("mustIncludePerpMarketIndexes:", [...(client.mustIncludePerpMarketIndexes || [])]);

  client.mustIncludePerpMarketIndexes?.add(0);
  client.mustIncludeSpotMarketIndexes?.add(0);
  client.mustIncludeSpotMarketIndexes?.add(1);
  console.log("After force add:", [...client.mustIncludePerpMarketIndexes]);

  // Build remaining accounts with the user account, see what's included
  const user = client.getUser();
  await user.fetchAccounts();
  const remaining = client.getRemainingAccounts({
    userAccounts: [user.getUserAccount()],
    readablePerpMarketIndex: 0,
    useMarketLastSlotCache: false,
  });
  console.log("Remaining accounts:");
  for (const r of remaining) {
    console.log(`  ${r.pubkey.toBase58()} writable=${r.isWritable}`);
  }

  await client.unsubscribe?.();
}

main().catch((e) => { console.error(e); process.exit(1); });
