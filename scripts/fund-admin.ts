/**
 * Move SOL from agent wallet to admin wallet so the admin can pay for
 * program deploys / extends.
 */
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const agent = Keypair.fromSecretKey(bs58.decode(process.env.AGENT_KEYPAIR!));
  const admin = new PublicKey("5cR5PY9VVtAij6qAaifqRqKcDK2xbzYUiibzDZvgsVQo");
  const lamports = 6 * 1e9;

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: agent.publicKey,
      toPubkey: admin,
      lamports,
    })
  );
  tx.feePayer = agent.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(agent);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  console.log("Moved 6 SOL agent → admin | tx:", sig);
}

main().catch(e => { console.error(e); process.exit(1); });
