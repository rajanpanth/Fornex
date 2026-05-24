import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useEffect, useMemo, useState } from "react";
import { PROGRAM_ID, VAULT_ADDRESS, VaultData } from "../lib/chain";

export function usePosition(vault: VaultData | null) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [userDeposit, setUserDeposit] = useState<{
    shares: bigint;
    totalDeposited: bigint;
  } | null>(null);

  useEffect(() => {
    if (!wallet.publicKey) {
      setUserDeposit(null);
      return;
    }
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_deposit"),
        VAULT_ADDRESS.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    connection
      .getAccountInfo(pda)
      .then((info) => {
        if (!info) {
          setUserDeposit(null);
          return;
        }
        const d = Buffer.from(info.data);
        const shares = d.readBigUInt64LE(8 + 32 + 32);
        const totalDeposited = d.readBigUInt64LE(8 + 32 + 32 + 8);
        setUserDeposit({ shares, totalDeposited });
      })
      .catch(() => setUserDeposit(null));
  }, [wallet.publicKey, connection]);

  const userSharesSol = useMemo(() => {
    if (!userDeposit || !vault || Number(vault.totalShares) === 0) return 0;
    return (
      (Number(userDeposit.shares) / Number(vault.totalShares)) *
      (Number(vault.nav) / LAMPORTS_PER_SOL)
    );
  }, [userDeposit, vault]);

  const userPnlPct = useMemo(() => {
    if (!userDeposit || Number(userDeposit.totalDeposited) === 0) return null;
    const deposited = Number(userDeposit.totalDeposited) / LAMPORTS_PER_SOL;
    return ((userSharesSol - deposited) / deposited) * 100;
  }, [userDeposit, userSharesSol]);

  return { userDeposit, userSharesSol, userPnlPct };
}
