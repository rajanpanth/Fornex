import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { createHash } from "crypto";

const PROGRAM_ID = new anchor.web3.PublicKey(
  "G9rWuMYMbhVSEavQrEUPAwWGT5xewZEibDBkoWQzTEfw"
);

type AgentVote = {
  direction: number;
  leverage: number;
  confidence: number;
  reasoning: string;
};

describe("fornex", () => {
  const adminKeypair = anchor.web3.Keypair.fromSeed(
    Uint8Array.from(Array(32).fill(7))
  );
  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed"),
    new anchor.Wallet(adminKeypair),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const connection = provider.connection;
  const admin = provider.wallet;
  const user = anchor.web3.Keypair.generate();
  const agent = anchor.web3.Keypair.generate();

  const zero = new anchor.BN(0);
  const oneSol = new anchor.BN(anchor.web3.LAMPORTS_PER_SOL);
  const updatedNav = new anchor.BN(anchor.web3.LAMPORTS_PER_SOL + 250_000_000);
  const withdrawShares = new anchor.BN(500_000_000);

  const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    PROGRAM_ID
  );

  const [userDeposit] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user_deposit"), vault.toBuffer(), user.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const [firstDecision] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("trade_log"), vault.toBuffer(), u32(1)],
    PROGRAM_ID
  );

  before(async () => {
    await transferSol(user.publicKey, 3 * anchor.web3.LAMPORTS_PER_SOL);
    await transferSol(agent.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  });

  it("initializes the vault", async () => {
    await sendInstruction(
      [
        discriminator("global", "initialize_vault"),
        agent.publicKey.toBuffer(),
      ],
      [
        writable(vault),
        signer(admin.publicKey, true),
        readonly(anchor.web3.SystemProgram.programId),
      ]
    );

    const vaultAccount = await fetchVault();

    expect(vaultAccount.agentAuthority.toBase58()).to.equal(
      agent.publicKey.toBase58()
    );
    expect(vaultAccount.admin.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(vaultAccount.totalDeposits.eq(zero)).to.equal(true);
    expect(vaultAccount.totalShares.eq(zero)).to.equal(true);
    expect(vaultAccount.nav.eq(zero)).to.equal(true);
    expect(vaultAccount.tradeCount).to.equal(0);
    expect(vaultAccount.winningTrades).to.equal(0);
  });

  it("deposits 1 SOL and mints 1:1 shares", async () => {
    await sendInstruction(
      [discriminator("global", "deposit"), u64(oneSol)],
      [
        writable(vault),
        writable(userDeposit),
        signer(user.publicKey, true),
        readonly(anchor.web3.SystemProgram.programId),
      ],
      [user]
    );

    const vaultAccount = await fetchVault();
    const userDepositAccount = await fetchUserDeposit();

    expect(vaultAccount.totalDeposits.eq(oneSol)).to.equal(true);
    expect(vaultAccount.totalShares.eq(oneSol)).to.equal(true);
    expect(vaultAccount.nav.eq(oneSol)).to.equal(true);
    expect(userDepositAccount.owner.toBase58()).to.equal(user.publicKey.toBase58());
    expect(userDepositAccount.vault.toBase58()).to.equal(vault.toBase58());
    expect(userDepositAccount.shares.eq(oneSol)).to.equal(true);
    expect(userDepositAccount.totalDeposited.eq(oneSol)).to.equal(true);
  });

  it("logs a multi-agent decision", async () => {
    const bullVote = vote(
      1,
      2,
      78,
      "Funding negative and OI rising; momentum favors long."
    );
    const bearVote = vote(
      0,
      1,
      61,
      "Price is close to resistance, so avoid chasing."
    );
    const zenVote = vote(
      1,
      1,
      72,
      "Spread is stable and liquidation wall offers support."
    );
    const consensus = vote(1, 2, 70, "Two of three agents agree on LONG.");

    await sendInstruction(
      [
        discriminator("global", "log_multi_agent_decision"),
        borshString("SOL-PERP"),
        encodeVote(bullVote),
        encodeVote(bearVote),
        encodeVote(zenVote),
        encodeVote(consensus),
        u64(new anchor.BN(250_000_000)),
        Buffer.from([1]),
        borshString("mock-drift-devnet-tx"),
      ],
      [
        writable(vault),
        writable(firstDecision),
        signer(agent.publicKey, true),
        readonly(anchor.web3.SystemProgram.programId),
      ],
      [agent]
    );

    const vaultAccount = await fetchVault();
    const decisionAccount = await fetchMultiAgentDecision();

    expect(vaultAccount.tradeCount).to.equal(1);
    expect(decisionAccount.vault.toBase58()).to.equal(vault.toBase58());
    expect(decisionAccount.decisionIndex).to.equal(1);
    expect(decisionAccount.market).to.equal("SOL-PERP");
    expect(decisionAccount.bullVote.direction).to.equal(1);
    expect(decisionAccount.bearVote.direction).to.equal(0);
    expect(decisionAccount.zenVote.direction).to.equal(1);
    expect(decisionAccount.consensus.direction).to.equal(1);
    expect(decisionAccount.consensus.leverage).to.equal(2);
    expect(decisionAccount.consensus.confidence).to.equal(70);
    expect(decisionAccount.sizeUsd.eq(new anchor.BN(250_000_000))).to.equal(true);
    expect(decisionAccount.executed).to.equal(true);
    expect(decisionAccount.executionRef).to.equal("mock-drift-devnet-tx");
  });

  it("updates NAV after the decision", async () => {
    await sendInstruction(
      [discriminator("global", "update_nav"), u64(updatedNav)],
      [writable(vault), signer(agent.publicKey, true)],
      [agent]
    );

    const vaultAccount = await fetchVault();

    expect(vaultAccount.nav.eq(updatedNav)).to.equal(true);
    expect(vaultAccount.winningTrades).to.equal(1);
  });

  it("withdraws shares and returns proportional SOL", async () => {
    const userBalanceBefore = await connection.getBalance(user.publicKey);

    await sendInstruction(
      [discriminator("global", "withdraw"), u64(withdrawShares)],
      [
        writable(vault),
        writable(userDeposit),
        signer(user.publicKey, true),
        readonly(anchor.web3.SystemProgram.programId),
      ],
      [user]
    );

    const userBalanceAfter = await connection.getBalance(user.publicKey);
    const vaultAccount = await fetchVault();
    const userDepositAccount = await fetchUserDeposit();

    const expectedSolOut = withdrawShares.mul(updatedNav).div(oneSol);
    const expectedRemainingShares = oneSol.sub(withdrawShares);
    const expectedRemainingNav = updatedNav.sub(expectedSolOut);

    expect(new anchor.BN(userBalanceAfter).gt(new anchor.BN(userBalanceBefore))).to.equal(
      true
    );
    expect(userDepositAccount.shares.eq(expectedRemainingShares)).to.equal(true);
    expect(vaultAccount.totalShares.eq(expectedRemainingShares)).to.equal(true);
    expect(vaultAccount.nav.eq(expectedRemainingNav)).to.equal(true);
    expect(vaultAccount.totalDeposits.eq(oneSol)).to.equal(true);
  });

  async function sendInstruction(
    dataParts: Buffer[],
    keys: anchor.web3.AccountMeta[],
    signers: anchor.web3.Signer[] = []
  ): Promise<string> {
    const ix = new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys,
      data: Buffer.concat(dataParts),
    });

    return provider.sendAndConfirm(new anchor.web3.Transaction().add(ix), signers);
  }

  async function transferSol(
    pubkey: anchor.web3.PublicKey,
    lamports: number
  ): Promise<void> {
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: pubkey,
          lamports,
        })
      )
    );
  }

  async function fetchVault() {
    const accountInfo = await connection.getAccountInfo(vault);
    expect(accountInfo).to.not.equal(null);

    const reader = new Reader(accountInfo!.data);
    reader.skip(8);

    return {
      agentAuthority: reader.publicKey(),
      admin: reader.publicKey(),
      totalDeposits: reader.u64(),
      totalShares: reader.u64(),
      nav: reader.u64(),
      tradeCount: reader.u32(),
      winningTrades: reader.u32(),
      isTradingPaused: reader.bool(),
      createdAt: reader.i64(),
      bump: reader.u8(),
    };
  }

  async function fetchUserDeposit() {
    const accountInfo = await connection.getAccountInfo(userDeposit);
    expect(accountInfo).to.not.equal(null);

    const reader = new Reader(accountInfo!.data);
    reader.skip(8);

    return {
      owner: reader.publicKey(),
      vault: reader.publicKey(),
      shares: reader.u64(),
      totalDeposited: reader.u64(),
      depositedAt: reader.i64(),
      bump: reader.u8(),
    };
  }

  async function fetchMultiAgentDecision() {
    const accountInfo = await connection.getAccountInfo(firstDecision);
    expect(accountInfo).to.not.equal(null);

    const reader = new Reader(accountInfo!.data);
    reader.skip(8);

    return {
      vault: reader.publicKey(),
      decisionIndex: reader.u32(),
      market: reader.fixedString(16),
      bullVote: reader.vote(),
      bearVote: reader.vote(),
      zenVote: reader.vote(),
      consensus: reader.vote(),
      sizeUsd: reader.u64(),
      executed: reader.bool(),
      executionRef: reader.fixedString(88),
      pnlLamports: reader.i64(),
      timestamp: reader.i64(),
      bump: reader.u8(),
    };
  }
});

class Reader {
  private offset = 0;

  constructor(private readonly data: Buffer) {}

  skip(bytes: number): void {
    this.offset += bytes;
  }

  publicKey(): anchor.web3.PublicKey {
    const value = new anchor.web3.PublicKey(
      this.data.subarray(this.offset, this.offset + 32)
    );
    this.offset += 32;
    return value;
  }

  u8(): number {
    const value = this.data.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  bool(): boolean {
    return this.u8() === 1;
  }

  u32(): number {
    const value = this.data.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  u64(): anchor.BN {
    const value = new anchor.BN(this.data.subarray(this.offset, this.offset + 8), "le");
    this.offset += 8;
    return value;
  }

  i64(): anchor.BN {
    return this.u64();
  }

  string(): string {
    const length = this.u32();
    const value = this.data
      .subarray(this.offset, this.offset + length)
      .toString("utf8");
    this.offset += length;
    return value;
  }

  vote(): AgentVote {
    return {
      direction: this.u8(),
      leverage: this.u8(),
      confidence: this.u8(),
      reasoning: this.fixedString(200),
    };
  }

  fixedString(size: number): string {
    const bytes = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    const length = bytes.indexOf(0);
    return bytes.subarray(0, length === -1 ? size : length).toString("utf8");
  }
}

function discriminator(namespace: string, name: string): Buffer {
  return createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest()
    .subarray(0, 8);
}

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function u64(value: anchor.BN): Buffer {
  return value.toArrayLike(Buffer, "le", 8);
}

function borshString(value: string): Buffer {
  const encoded = Buffer.from(value, "utf8");
  return Buffer.concat([u32(encoded.length), encoded]);
}

function vote(
  direction: number,
  leverage: number,
  confidence: number,
  reasoning: string
): AgentVote {
  return { direction, leverage, confidence, reasoning };
}

function encodeVote(value: AgentVote): Buffer {
  return Buffer.concat([
    Buffer.from([value.direction, value.leverage, value.confidence]),
    borshString(value.reasoning),
  ]);
}

function fixedBytes(value: string, size: number): Buffer {
  const output = Buffer.alloc(size);
  Buffer.from(value, "utf8").subarray(0, size).copy(output);
  return output;
}

function readonly(pubkey: anchor.web3.PublicKey): anchor.web3.AccountMeta {
  return { pubkey, isSigner: false, isWritable: false };
}

function writable(pubkey: anchor.web3.PublicKey): anchor.web3.AccountMeta {
  return { pubkey, isSigner: false, isWritable: true };
}

function signer(
  pubkey: anchor.web3.PublicKey,
  isWritable: boolean
): anchor.web3.AccountMeta {
  return { pubkey, isSigner: true, isWritable };
}
