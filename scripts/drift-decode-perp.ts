import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import { Connection, PublicKey } from "@solana/web3.js";

async function main() {
  const drift = await import("@drift-labs/sdk");
  const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");

  // Compute the canonical perp market 0 PDA from the program ID
  const programId = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
  const [perpMarket0Pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("perp_market"), Buffer.from(new Uint16Array([0]).buffer)],
    programId
  );
  console.log("Computed perp market 0 PDA:", perpMarket0Pda.toBase58());

  const [spotMarket0Pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("spot_market"), Buffer.from(new Uint16Array([0]).buffer)],
    programId
  );
  console.log("Computed spot market 0 PDA:", spotMarket0Pda.toBase58());

  // Compare with what SDK reports
  const wallet = {
    publicKey: PublicKey.default,
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

  const perp0 = client.getPerpMarketAccount(0);
  const spot0 = client.getSpotMarketAccount(0);
  console.log("SDK perp market 0 pubkey:  ", perp0?.pubkey?.toBase58?.());
  console.log("SDK spot market 0 pubkey:  ", spot0?.pubkey?.toBase58?.());
  console.log("SDK perp market 0 status:  ", perp0?.status);
  console.log("SDK perp market 0 marketIdx:", perp0?.marketIndex);
  console.log("SDK spot market 0 marketIdx:", spot0?.marketIndex);
  console.log("SDK spot market 0 status:  ", spot0?.status);

  // Print first byte of each so we can see discriminator
  const perpInfo = await conn.getAccountInfo(perp0.pubkey);
  console.log("Perp account disc (hex):", perpInfo?.data.subarray(0, 8).toString("hex"));
  const spotInfo = await conn.getAccountInfo(spot0.pubkey);
  console.log("Spot account disc (hex):", spotInfo?.data.subarray(0, 8).toString("hex"));

  await client.unsubscribe?.();
}

main().catch((e) => { console.error(e); process.exit(1); });
