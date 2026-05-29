import { PublicKey } from "@solana/web3.js";

/**
 * Minimal little-endian binary reader. Mirrors the layout used by Anchor.
 * Internal — exported only so dependent decoders can be tested in isolation.
 */
export class Reader {
  private offset = 0;
  private readonly data: Buffer;

  constructor(data: Buffer | Uint8Array) {
    this.data = Buffer.from(data);
  }

  skip(n: number): void {
    this.offset += n;
  }

  remaining(): number {
    return this.data.length - this.offset;
  }

  publicKey(): PublicKey {
    const key = new PublicKey(
      this.data.subarray(this.offset, this.offset + 32)
    );
    this.offset += 32;
    return key;
  }

  u8(): number {
    const v = this.data.readUInt8(this.offset);
    this.offset += 1;
    return v;
  }

  bool(): boolean {
    return this.u8() === 1;
  }

  u32(): number {
    const v = this.data.readUInt32LE(this.offset);
    this.offset += 4;
    return v;
  }

  u64(): bigint {
    const v = this.data.readBigUInt64LE(this.offset);
    this.offset += 8;
    return v;
  }

  i64(): bigint {
    const v = this.data.readBigInt64LE(this.offset);
    this.offset += 8;
    return v;
  }

  fixedBytes(size: number): Buffer {
    const slice = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    return slice;
  }

  fixedString(size: number): string {
    const bytes = this.fixedBytes(size);
    const end = bytes.indexOf(0);
    return bytes
      .subarray(0, end === -1 ? size : end)
      .toString("utf8");
  }
}
