/**
 * scripts/setup-agent.ts
 * Generates a new Solana keypair for the agent, saves it to agent/.env,
 * airdrops devnet SOL, and prints the public key.
 *
 * Usage:
 *   npx ts-node scripts/setup-agent.ts
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Fornex Protocol — Agent Wallet Setup");
  console.log("═══════════════════════════════════════════════════\n");

  const envPath = path.join(__dirname, "..", "agent", ".env");

  // Check if agent keypair already exists
  let agent: Keypair;
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/AGENT_KEYPAIR=(.+)/);
    if (match && match[1] && match[1] !== "<base58 private key>") {
      console.log("⚠️  Agent keypair already exists in agent/.env");
      agent = Keypair.fromSecretKey(bs58.decode(match[1].trim()));
      console.log("Agent public key:", agent.publicKey.toBase58());
    } else {
      agent = Keypair.generate();
      console.log("Generated new agent keypair");
      console.log("Agent public key:", agent.publicKey.toBase58());
    }
  } else {
    agent = Keypair.generate();
    console.log("Generated new agent keypair");
    console.log("Agent public key:", agent.publicKey.toBase58());
  }

  // Save to agent/.env
  const agentSecret = bs58.encode(agent.secretKey);
  const envLines: string[] = [];

  if (fs.existsSync(envPath)) {
    const existing = fs.readFileSync(envPath, "utf-8");
    const updated = existing.includes("AGENT_KEYPAIR=")
      ? existing.replace(/AGENT_KEYPAIR=.*/, `AGENT_KEYPAIR=${agentSecret}`)
      : `AGENT_KEYPAIR=${agentSecret}\n` + existing;
    envLines.push(updated);
  } else {
    envLines.push(`AGENT_KEYPAIR=${agentSecret}`);
    envLines.push(
      `VAULT_PROGRAM_ID=H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf`
    );
    envLines.push(`VAULT_ADDRESS=`);
    envLines.push(`SOLANA_RPC_URL=https://api.devnet.solana.com`);
    envLines.push(`DRIFT_ENV=devnet`);
    envLines.push(``);
  }

  fs.writeFileSync(envPath, envLines.join("\n"), "utf-8");
  console.log(`\nSaved agent keypair to ${envPath}`);

  // Check balance
  const balance = await connection.getBalance(agent.publicKey);
  console.log(
    `\nCurrent balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
  );

  // Airdrop if low
  if (balance < 1 * LAMPORTS_PER_SOL) {
    console.log("Requesting airdrop of 2 SOL...");
    try {
      const sig = await connection.requestAirdrop(
        agent.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig, "confirmed");
      const newBalance = await connection.getBalance(agent.publicKey);
      console.log(
        `✅ Airdrop successful! Balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
      );
    } catch (err) {
      console.log(
        `⚠️  Airdrop failed (rate limit?). Please airdrop manually:`
      );
      console.log(
        `   solana airdrop 2 ${agent.publicKey.toBase58()} --url devnet`
      );
      console.log(`   Or use: https://faucet.solana.com`);
    }
  } else {
    console.log("✅ Agent wallet already funded");
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  AGENT SETUP COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`\n  Public key: ${agent.publicKey.toBase58()}`);
  console.log(
    `  Balance: ${((await connection.getBalance(agent.publicKey)) / LAMPORTS_PER_SOL).toFixed(4)} SOL`
  );
  console.log(`\n  Next step: Initialize vault with this agent's pubkey:`);
  console.log(
    `  npx ts-node scripts/init-vault.ts ${agent.publicKey.toBase58()}`
  );
}

main().catch((err) => {
  console.error("❌ Failed to setup agent:", err);
  process.exit(1);
});
