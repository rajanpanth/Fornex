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

  const client = new (drift as any).DriftClient({
    connection: conn,
    wallet,
    env: "devnet",
  });
  await client.subscribe();

  console.log("Drift devnet spot markets:");
  const spots = client.getSpotMarketAccounts?.() || [];
  for (const m of spots) {
    const name = Buffer.from(m.name).toString("utf8").trim();
    console.log(
      `  index=${m.marketIndex} name=${name} mint=${m.mint?.toBase58?.()}`
    );
  }
  await client.unsubscribe();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
