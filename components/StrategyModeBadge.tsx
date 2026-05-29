import { useEffect, useState } from "react";
import { Connection } from "@solana/web3.js";
import { Buffer } from "buffer";
import { ExternalLink, Settings2 } from "lucide-react";
import {
  RPC_URL,
  StrategyModeLabel,
  VAULT_ADDRESS,
  VaultStrategyData,
  decodeVaultStrategy,
  deriveVaultStrategyPda,
  strategyLabelFromMode,
} from "../lib/chain";

/**
 * StrategyModeBadge
 * -----------------
 * Reads the `VaultStrategy` PDA and shows the active strategy label
 * (Momentum / MeanRevert / RangeDCA) plus a deep-link to Explorer.
 *
 * If the PDA isn't initialized yet, falls back to "Momentum (default)" —
 * matching the agent runtime, which uses Momentum prompts when the PDA
 * is missing. This keeps the dashboard honest across deploys.
 */

const POLL_INTERVAL_MS = 60_000;

const MODE_COPY: Record<StrategyModeLabel, string> = {
  Momentum: "Funding-driven trend follow with squeeze bias.",
  MeanRevert: "Fade overextensions on mark/index spread + L/S.",
  RangeDCA: "Stage entries inside ranges, exit on regime break.",
};

export default function StrategyModeBadge() {
  const [data, setData] = useState<VaultStrategyData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pda = deriveVaultStrategyPda(VAULT_ADDRESS);

  useEffect(() => {
    let cancelled = false;
    const connection = new Connection(RPC_URL, "confirmed");

    async function read() {
      try {
        const info = await connection.getAccountInfo(pda);
        if (cancelled) return;
        if (!info) {
          setData(null);
          setLoaded(true);
          return;
        }
        setData(decodeVaultStrategy(pda, Buffer.from(info.data)));
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }

    void read();
    const id = window.setInterval(() => void read(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pda]);

  // Fall back to the on-chain default when the PDA isn't initialized.
  const label: StrategyModeLabel = data ? data.modeLabel : strategyLabelFromMode(0);
  const sub = MODE_COPY[label];
  const explorer = `https://explorer.solana.com/address/${pda.toBase58()}?cluster=devnet`;
  const initialized = Boolean(data);

  return (
    <section className="strategy-badge" aria-label="Active strategy mode">
      <header className="strategy-badge__header">
        <span className="strategy-badge__title">
          <Settings2 size={13} /> Strategy mode
        </span>
        <a
          className="strategy-badge__link"
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{`${pda.toBase58().slice(0, 4)}…${pda.toBase58().slice(-4)}`}</span>
          <ExternalLink size={11} />
        </a>
      </header>

      <div className={`strategy-badge__chip strategy-badge__chip--${label.toLowerCase()}`}>
        <strong>{label}</strong>
        {!initialized && loaded && <span>default</span>}
      </div>

      <p className="strategy-badge__sub">{sub}</p>

      <footer className="strategy-badge__footer">
        {initialized ? (
          <span>
            Set on-chain via <code>set_strategy_mode</code>. Brain reads it at
            the top of every cycle.
          </span>
        ) : (
          <span>
            <code>VaultStrategy</code> PDA not initialized — admin runs{" "}
            <code>init_vault_strategy</code> once to enable mode switching.
          </span>
        )}
      </footer>
    </section>
  );
}
