import { createHash } from "crypto";
import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  connection,
  loadAgentKeypair,
  PROGRAM_ID,
  VAULT_ADDRESS,
} from "../config";
import type { CurrentPosition, Direction } from "../types";
import type { PerpExecutor } from "./types";
import { fetchVault } from "../logger";

const PYTH_SOL_USD_PRICE_UPDATE_ACCOUNT = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"
);

/**
 * On-chain synthetic perpetual executor. Opens a SyntheticPosition PDA on the
 * Fornex program; close stamps the Pyth close price and computes realized
 * PnL in lamports. Bounded ±50% of NAV per close.
 *
 * No external dex dependency. No mock data. Real Pyth prices, real on-chain
 * accounts, real PnL.
 */
export class SyntheticExecutor implements PerpExecutor {
  readonly name = "synthetic";
  private agent = loadAgentKeypair();

  async init(): Promise<void> {
    console.log("[synthetic] executor ready (on-chain Pyth-marked positions)");
  }

  async open(
    direction: Exclude<Direction, "FLAT">,
    leverage: number,
    collateralSOL: number
  ): Promise<string | null> {
    try {
      const vault = await fetchVault();
      const positionIndex = vault.syntheticPositionCount + 1;
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("synthetic_position"),
          VAULT_ADDRESS.toBuffer(),
          u32(positionIndex),
        ],
        PROGRAM_ID
      );

      const cappedLeverage = Math.min(3, Math.max(1, Math.round(leverage)));
      const collateralLamports = new BN(Math.round(collateralSOL * 1e9));
      const directionByte = direction === "LONG" ? 1 : 2;

      const data = Buffer.concat([
        discriminator("global", "open_synthetic_position"),
        Buffer.from([directionByte]),
        Buffer.from([cappedLeverage]),
        collateralLamports.toArrayLike(Buffer, "le", 8),
      ]);

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          writable(VAULT_ADDRESS),
          writable(positionPda),
          readonly(PYTH_SOL_USD_PRICE_UPDATE_ACCOUNT),
          signer(this.agent.publicKey),
          readonly(SystemProgram.programId),
        ],
        data,
      });

      const sig = await this.send(ix, "open synthetic position");
      console.log(
        `[synthetic] opened ${direction} ${cappedLeverage}x collateral=${collateralSOL.toFixed(4)} SOL → ${positionPda.toBase58()} | tx: ${sig}`
      );
      return sig;
    } catch (e: any) {
      console.warn("[synthetic] open failed:", e?.message || e);
      return null;
    }
  }

  async close(): Promise<{ txSig: string | null; realizedPnl: number } | null> {
    try {
      const open = await this.findOpenPosition();
      if (!open) return null;

      const data = discriminator("global", "close_synthetic_position");
      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          writable(VAULT_ADDRESS),
          writable(open.pubkey),
          readonly(PYTH_SOL_USD_PRICE_UPDATE_ACCOUNT),
          signer(this.agent.publicKey),
        ],
        data,
      });

      const sig = await this.send(ix, "close synthetic position");
      // Fetch realized PnL from the now-closed position account
      const closed = await this.fetchPosition(open.pubkey);
      const realizedPnl = closed
        ? Number(closed.realizedPnlLamports) / 1e9
        : 0;
      console.log(
        `[synthetic] closed position #${open.positionIndex} realizedPnl=${realizedPnl.toFixed(6)} SOL | tx: ${sig}`
      );
      return { txSig: sig, realizedPnl };
    } catch (e: any) {
      console.warn("[synthetic] close failed:", e?.message || e);
      return null;
    }
  }

  async getCurrentPosition(): Promise<CurrentPosition | null> {
    try {
      const open = await this.findOpenPosition();
      if (!open) return null;
      return {
        direction: open.direction === 1 ? "LONG" : "SHORT",
        baseAssetAmount:
          (open.direction === 1 ? 1 : -1) * Number(open.collateralLamports),
        leverage: open.leverage,
        entryPrice: Number(open.entryPrice) / 1e8, // Pyth Lazer 1e8 → USD
      };
    } catch {
      return null;
    }
  }

  async shutdown(): Promise<void> {
    // no-op
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private async send(ix: TransactionInstruction, label: string): Promise<string> {
    const tx = new Transaction().add(ix);
    tx.feePayer = this.agent.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(this.agent);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }

  /** Scan SyntheticPosition PDAs derived from sequential indexes. */
  private async findOpenPosition(): Promise<DecodedSyntheticPosition | null> {
    const vault = await fetchVault();
    const total = vault.syntheticPositionCount;
    // Walk backwards: most recent position is most likely to be open.
    for (let i = total; i >= 1; i--) {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("synthetic_position"), VAULT_ADDRESS.toBuffer(), u32(i)],
        PROGRAM_ID
      );
      const decoded = await this.fetchPosition(pda);
      if (decoded?.isOpen) return { ...decoded, pubkey: pda };
    }
    return null;
  }

  private async fetchPosition(pda: PublicKey): Promise<DecodedSyntheticPosition | null> {
    const info = await connection.getAccountInfo(pda);
    if (!info) return null;
    return decodeSyntheticPosition(pda, info.data);
  }
}

interface DecodedSyntheticPosition {
  pubkey: PublicKey;
  vault: PublicKey;
  positionIndex: number;
  direction: number;
  leverage: number;
  entryPrice: bigint;
  closePrice: bigint;
  collateralLamports: bigint;
  sizeUsd: bigint;
  openedAt: bigint;
  closedAt: bigint;
  realizedPnlLamports: bigint;
  isOpen: boolean;
}

function decodeSyntheticPosition(
  pubkey: PublicKey,
  data: Buffer
): DecodedSyntheticPosition | null {
  try {
    let off = 8; // disc
    const vault = new PublicKey(data.subarray(off, off + 32));
    off += 32;
    const positionIndex = data.readUInt32LE(off);
    off += 4;
    const direction = data.readUInt8(off);
    off += 1;
    const leverage = data.readUInt8(off);
    off += 1;
    const entryPrice = data.readBigUInt64LE(off);
    off += 8;
    const closePrice = data.readBigUInt64LE(off);
    off += 8;
    const collateralLamports = data.readBigUInt64LE(off);
    off += 8;
    const sizeUsd = data.readBigUInt64LE(off);
    off += 8;
    const openedAt = data.readBigInt64LE(off);
    off += 8;
    const closedAt = data.readBigInt64LE(off);
    off += 8;
    const realizedPnlLamports = data.readBigInt64LE(off);
    off += 8;
    const isOpen = data.readUInt8(off) === 1;
    return {
      pubkey,
      vault,
      positionIndex,
      direction,
      leverage,
      entryPrice,
      closePrice,
      collateralLamports,
      sizeUsd,
      openedAt,
      closedAt,
      realizedPnlLamports,
      isOpen,
    };
  } catch {
    return null;
  }
}

function discriminator(namespace: string, name: string): Buffer {
  return createHash("sha256").update(`${namespace}:${name}`).digest().subarray(0, 8);
}

function u32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return buf;
}

function readonly(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: false };
}
function writable(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: true };
}
function signer(pubkey: PublicKey) {
  return { pubkey, isSigner: true, isWritable: true };
}
