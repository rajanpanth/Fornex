import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ShieldCheck, WalletCards } from "lucide-react";

export default function WalletDisconnected() {
  // Wallet adapter button renders different markup on server vs client
  // (icon nodes etc). Wait for client mount to avoid hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="wallet-empty">
      <div className="wallet-empty__icon" aria-hidden="true">
        <WalletCards size={22} />
      </div>
      <h3 className="wallet-empty__title">Connect to view your position</h3>
      <p className="wallet-empty__sub">
        Read access to the vault, decisions, and proof works without a wallet.
        Connecting is only required to deposit, withdraw, or read your $FNRX
        balance.
      </p>
      <div className="wallet-empty__cta" suppressHydrationWarning>
        {mounted ? (
          <WalletMultiButton />
        ) : (
          <button className="wallet-empty__cta-skeleton" disabled>
            Loading wallet…
          </button>
        )}
      </div>
      <ul className="wallet-empty__bullets">
        <li>
          <ShieldCheck size={13} aria-hidden="true" />
          Non-custodial vault on Solana devnet
        </li>
        <li>
          <ShieldCheck size={13} aria-hidden="true" />
          Every trade has an on-chain decision PDA
        </li>
      </ul>
    </div>
  );
}
