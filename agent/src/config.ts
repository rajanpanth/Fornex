import "dotenv/config";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const DRIFT_ENV = process.env.DRIFT_ENV || "devnet";
export const PROGRAM_ID = new PublicKey(
  process.env.VAULT_PROGRAM_ID || "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf"
);
export const VAULT_ADDRESS = new PublicKey(
  process.env.VAULT_ADDRESS || PublicKey.default.toBase58()
);
export const SOL_PER_TRADE_PAYMENT = 0.001;
export const LAMPORTS_PER_TRADE_PAYMENT = 1_000_000;

export const connection = new Connection(SOLANA_RPC_URL, "confirmed");

export function loadAgentKeypair(): Keypair {
  const encoded = process.env.AGENT_KEYPAIR;
  if (!encoded) {
    throw new Error("AGENT_KEYPAIR is required for agent execution");
  }
  return Keypair.fromSecretKey(bs58.decode(encoded));
}

export function truncateReasoning(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

