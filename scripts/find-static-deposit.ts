/**
 * Look for a successful Drift devnet tx that uses STATIC accounts (no LUT).
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

const DRIFT = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

function disc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const sigs = await conn.getSignaturesForAddress(DRIFT, { limit: 1000 });
  console.log("Got", sigs.length, "recent sigs");

  let staticOk = 0, lutOk = 0;
  for (const s of sigs) {
    if (s.err) continue;
    try {
      const tx = await conn.getTransaction(s.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) continue;
      const msg: any = tx.transaction.message;
      const isV0 = msg.version === 0;
      const lookupTables = (msg as any).addressTableLookups || [];
      const hasLut = lookupTables.length > 0;
      if (hasLut) lutOk++;
      else staticOk++;

      if (!hasLut && staticOk <= 3) {
        console.log("Static-only success:", s.signature, "version=", msg.version || "legacy");
        const ixs = msg.compiledInstructions || msg.instructions;
        for (const ix of ixs) {
          const pid = (msg.staticAccountKeys || msg.accountKeys)[ix.programIdIndex];
          if (pid?.equals?.(DRIFT)) {
            const data = Buffer.from(ix.data);
            const ixDisc = data.subarray(0, 8).toString("hex");
            const ixName: any = {
              [disc("deposit").toString("hex")]: "deposit",
              [disc("withdraw").toString("hex")]: "withdraw",
              [disc("placePerpOrder").toString("hex")]: "placePerpOrder",
              [disc("placeAndTakePerpOrder").toString("hex")]: "placeAndTakePerpOrder",
              [disc("settlePnl").toString("hex")]: "settlePnl",
              [disc("initializeUser").toString("hex")]: "initializeUser",
              [disc("initializeUserStats").toString("hex")]: "initializeUserStats",
            }[ixDisc] || `unknown(${ixDisc.slice(0, 8)})`;
            console.log("  ix:", ixName);
          }
        }
      }
    } catch {}
    if (staticOk >= 5 && lutOk >= 5) break;
  }
  console.log("\nStatic OK:", staticOk, "LUT OK:", lutOk);
}

main().catch(e => { console.error(e); process.exit(1); });
