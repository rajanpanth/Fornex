import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", ".env") });
import bs58 from "bs58";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const DRIFT_ENV = process.env.DRIFT_ENV || "devnet";

/**
 * SIGNAL FEED — separate RPC + Drift env used only for reading market
 * signals. Drift devnet markets carry almost no real volume, so funding,
 * open interest, and L/S ratios all sit at zero — making every agent
 * vote default to FLAT. By pointing the signal feed at mainnet-beta
 * (read-only), the agents see real market conditions and produce
 * meaningful debates while execution stays on devnet.
 *
 * All trading, vault writes, decision logging, and pay.sh transfers
 * continue to use SOLANA_RPC_URL / DRIFT_ENV unchanged.
 */
export const SIGNALS_RPC_URL =
  process.env.SIGNALS_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";
export const SIGNALS_DRIFT_ENV = process.env.SIGNALS_DRIFT_ENV || DRIFT_ENV;

export const PROGRAM_ID = new PublicKey(
  process.env.VAULT_PROGRAM_ID || "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf"
);
export const VAULT_ADDRESS = new PublicKey(
  process.env.VAULT_ADDRESS || PublicKey.default.toBase58()
);
export const SOL_PER_TRADE_PAYMENT = 0.001;
export const LAMPORTS_PER_TRADE_PAYMENT = 1_000_000;

export const connection = new Connection(SOLANA_RPC_URL, "confirmed");
export const signalsConnection = new Connection(SIGNALS_RPC_URL, "confirmed");

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

