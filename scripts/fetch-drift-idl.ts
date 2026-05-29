import { Connection, PublicKey } from "@solana/web3.js";
import { inflate } from "zlib";
import { promisify } from "util";
import * as fs from "fs";

const inflateAsync = promisify(inflate);

async function main() {
  const conn = new Connection("https://api.devnet.solana.com");
  const programId = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
  const [base] = PublicKey.findProgramAddressSync([], programId);
  const idlAddr = await PublicKey.createWithSeed(base, "anchor:idl", programId);
  const info = await conn.getAccountInfo(idlAddr);
  if (!info) throw new Error("no IDL account");

  // Anchor IDL account layout: 8 bytes discriminator | 32 bytes authority | 4 bytes data length | data (zlib raw deflate)
  const authority = new PublicKey(info.data.subarray(8, 40));
  const dataLen = info.data.readUInt32LE(40);
  console.log("IDL authority:", authority.toBase58());
  console.log("IDL data length:", dataLen);
  const compressed = info.data.subarray(44, 44 + dataLen);
  const json = (await inflateAsync(compressed)).toString("utf8");
  fs.writeFileSync("drift-deployed-idl.json", json);
  console.log("Wrote drift-deployed-idl.json");

  const idl = JSON.parse(json);
  const dep = idl.instructions.find((i: any) => i.name === "deposit");
  console.log("Deposit accounts:");
  dep.accounts.forEach((a: any, i: number) => console.log(`  [${i}]`, a.name, "isMut="+(a.writable ?? a.isMut), "isSigner="+(a.signer ?? a.isSigner)));

  const ppo = idl.instructions.find((i: any) => i.name === "placePerpOrder" || i.name === "place_perp_order");
  console.log("\nPlacePerpOrder accounts:");
  ppo?.accounts.forEach((a: any, i: number) => console.log(`  [${i}]`, a.name, "isMut="+(a.writable ?? a.isMut), "isSigner="+(a.signer ?? a.isSigner)));
}

main().catch((e) => { console.error(e); process.exit(1); });
