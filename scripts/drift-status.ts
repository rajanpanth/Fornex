import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
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
    perpMarketIndexes: [0],
    spotMarketIndexes: [0, 1],
  });
  await client.subscribe();

  try {
    const user = client.getUser();
    await user.fetchAccounts();
    const acct = user.getUserAccount();
    console.log("User account:", user.getUserAccountPublicKey().toBase58());
    console.log("Sub-account name:", Buffer.from(acct.name || []).toString("utf8").trim());
    console.log("Total deposits (spot):");
    for (const sp of acct.spotPositions) {
      const amt = sp?.scaledBalance ? sp.scaledBalance.toString() : "0";
      console.log(`  market=${sp.marketIndex} balance=${amt}`);
    }
    console.log("Perp positions:");
    for (const pp of acct.perpPositions) {
      const base = pp?.baseAssetAmount ? pp.baseAssetAmount.toString() : "0";
      console.log(`  market=${pp.marketIndex} base=${base}`);
    }
  } catch (e: any) {
    console.log("No Drift user account yet:", e?.message || e);
  }

  console.log("Agent SOL balance:", (await conn.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL);
  await client.unsubscribe();
}

main().catch((e) => { console.error(e); process.exit(1); });
