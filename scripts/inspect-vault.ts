import { Connection, PublicKey } from "@solana/web3.js";

const VAULT_ADDRESS = new PublicKey("HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR");
const RPC = "https://api.devnet.solana.com";

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const info = await conn.getAccountInfo(VAULT_ADDRESS);
  if (!info) throw new Error("vault not found");
  const d = info.data;
  console.log("size:", d.length);
  let off = 8;
  const agentAuthority = new PublicKey(d.subarray(off, off + 32)); off += 32;
  const admin = new PublicKey(d.subarray(off, off + 32)); off += 32;
  const totalDeposits = d.readBigUInt64LE(off); off += 8;
  const totalShares = d.readBigUInt64LE(off); off += 8;
  const nav = d.readBigUInt64LE(off); off += 8;
  const tradeCount = d.readUInt32LE(off); off += 4;
  const winningTrades = d.readUInt32LE(off); off += 4;
  const isPaused = d.readUInt8(off) === 1; off += 1;
  const createdAt = d.readBigInt64LE(off); off += 8;
  const bump = d.readUInt8(off); off += 1;
  const navRecordCount = d.readBigUInt64LE(off); off += 8;
  const executedTradeCount = d.readUInt32LE(off); off += 4;
  const inceptionNav = d.readBigUInt64LE(off); off += 8;
  const syntheticPositionCount = d.readUInt32LE(off); off += 4;
  console.log({
    agentAuthority: agentAuthority.toBase58(),
    admin: admin.toBase58(),
    totalDeposits: Number(totalDeposits) / 1e9,
    totalShares: totalShares.toString(),
    nav: Number(nav) / 1e9,
    tradeCount,
    winningTrades,
    isPaused,
    createdAt: createdAt.toString(),
    bump,
    navRecordCount: navRecordCount.toString(),
    executedTradeCount,
    inceptionNav: Number(inceptionNav) / 1e9,
    syntheticPositionCount,
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
