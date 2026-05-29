import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import { Connection } from "@solana/web3.js";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

async function main() {
  const drift = await import("@drift-labs/sdk");
  const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const kp = Keypair.fromSecretKey(bs58.decode(process.env.AGENT_KEYPAIR!));
  const wallet = { publicKey: kp.publicKey, signTransaction: async (t: any) => t, signAllTransactions: async (t: any[]) => t };
  const accountLoader = new (drift as any).BulkAccountLoader(conn, "confirmed", 1000);
  const client = new (drift as any).DriftClient({
    connection: conn, wallet, env: "devnet",
    perpMarketIndexes: [0], spotMarketIndexes: [0, 1],
    accountSubscription: { type: "polling", accountLoader },
  });
  await client.subscribe();
  await new Promise(r => setTimeout(r, 5000));
  await accountLoader.load();

  const spot0 = client.getSpotMarketAccount(0);
  console.log("USDC spot 0:");
  console.log("  pubkey:           ", spot0.pubkey.toBase58());
  console.log("  mint:             ", spot0.mint.toBase58());
  console.log("  vault:            ", spot0.vault.toBase58());
  console.log("  oracle:           ", spot0.oracle.toBase58());
  console.log("  oracleSource:     ", spot0.oracleSource);
  console.log("  marketIndex:      ", spot0.marketIndex);
  console.log("  status:           ", spot0.status);
  console.log("  decimals:         ", spot0.decimals);

  const perp0 = client.getPerpMarketAccount(0);
  console.log("\nSOL-PERP perp 0:");
  console.log("  pubkey:           ", perp0.pubkey.toBase58());
  console.log("  oracle:           ", perp0.amm.oracle.toBase58());
  console.log("  oracleSource:     ", perp0.amm.oracleSource);
  console.log("  quoteSpotMarket:  ", perp0.quoteSpotMarketIndex);
  console.log("  marketIndex:      ", perp0.marketIndex);

  const state = await client.getStatePublicKey();
  console.log("\nState account:", state.toBase58());
  await client.unsubscribe?.();
}

main().catch(e => { console.error(e); process.exit(1); });
