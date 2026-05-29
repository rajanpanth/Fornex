/**
 * Scan recent Drift transactions on devnet and find one that contains a successful
 * Deposit instruction. Print its account list so we can compare against ours.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

const DRIFT = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

function disc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const depositDisc = disc("deposit").toString("hex");
  console.log("Looking for deposit ix discriminator:", depositDisc);

  const sigs = await conn.getSignaturesForAddress(DRIFT, { limit: 200 });
  console.log("Got", sigs.length, "recent signatures");

  let found = 0;
  for (const s of sigs) {
    if (s.err) continue;
    try {
      const tx = await conn.getTransaction(s.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) continue;
      const msg: any = tx.transaction.message;
      const allKeys: PublicKey[] = msg.staticAccountKeys || msg.accountKeys || [];
      const ixs = msg.compiledInstructions || msg.instructions || [];

      for (const ix of ixs) {
        const programIdIdx = ix.programIdIndex;
        const programId = allKeys[programIdIdx];
        if (!programId || !programId.equals(DRIFT)) continue;
        const data = Buffer.from(ix.data);
        const hexDisc = data.subarray(0, 8).toString("hex");
        if (hexDisc !== depositDisc) continue;

        console.log("\n✅ Found deposit tx:", s.signature);
        console.log(`   https://explorer.solana.com/tx/${s.signature}?cluster=devnet`);
        const indexes: number[] = ix.accountKeyIndexes || ix.accounts || [];
        console.log("Account count:", indexes.length);
        for (let i = 0; i < indexes.length; i++) {
          const idx = indexes[i];
          const key = allKeys[idx];
          const isWritable = msg.isAccountWritable ? msg.isAccountWritable(idx) : (idx < (msg.header?.numRequiredSignatures ?? 0));
          const isSigner = idx < (msg.header?.numRequiredSignatures ?? 0);
          console.log(`  [${i}] idx=${idx} ${key.toBase58()}  signer=${isSigner} writable=${isWritable}`);
        }
        const marketIndex = data.readUInt16LE(8);
        const amount = data.readBigUInt64LE(10);
        console.log("  args: marketIndex=", marketIndex, "amount=", amount.toString());
        found++;
        if (found >= 1) return;
      }
    } catch (e: any) {
      // continue
    }
  }
  console.log("Found", found, "deposit txs in recent history");
}

main().catch(e => { console.error(e); process.exit(1); });
