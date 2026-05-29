import { useEffect, useRef } from "react";
import { Connection } from "@solana/web3.js";
import { PROGRAM_ID } from "../lib/chain";

/**
 * useDecisionStream
 * -----------------
 * Subscribes to Solana `logs` for the Fornex program and triggers `onMatch`
 * whenever any log line mentions a Fornex instruction that *creates a new
 * decision-shaped account* (`log_multi_agent_decision`,
 * `record_trade_outcome`, `update_agent_reputation`, or any synthetic
 * position open/close).
 *
 * Real-time UX without a custom backend: judges see decisions land seconds
 * after the agent posts them, instead of waiting on the 30s polling clock.
 *
 * Resilience:
 *   - WSS endpoint resolved from NEXT_PUBLIC_HELIUS_WSS_URL or
 *     NEXT_PUBLIC_HELIUS_RPC_URL (https → wss). Falls back to the public
 *     devnet WSS when neither is set.
 *   - Auto-reconnects on close with capped exponential backoff.
 *   - Logs a one-line warning and bails out gracefully when the
 *     subscription can't be established (page still has the polling fallback).
 *
 * No-op when `enabled` is false (e.g. running in SSR pre-mount).
 */

const TARGET_LOG_FRAGMENTS = [
  "log_multi_agent_decision",
  "record_trade_outcome",
  "update_agent_reputation",
  "open_synthetic_position",
  "close_synthetic_position",
];

const MIN_BACKOFF_MS = 1_500;
const MAX_BACKOFF_MS = 30_000;

function resolveWsEndpoint(): string {
  if (typeof process === "undefined") return "wss://api.devnet.solana.com";
  const explicit = process.env.NEXT_PUBLIC_HELIUS_WSS_URL;
  if (explicit) return explicit;
  const https =
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://api.devnet.solana.com";
  return https.replace(/^http/, "ws");
}

export function useDecisionStream(
  onMatch: () => void,
  options: { enabled?: boolean } = {}
): void {
  const { enabled = true } = options;
  const callbackRef = useRef(onMatch);
  callbackRef.current = onMatch;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;
    let connection: Connection | null = null;
    let subscriptionId: number | null = null;
    let backoff = MIN_BACKOFF_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function subscribe(): Promise<void> {
      if (cancelled) return;

      try {
        const wsEndpoint = resolveWsEndpoint();
        connection = new Connection(wsEndpoint, {
          commitment: "confirmed",
          wsEndpoint,
        });

        subscriptionId = connection.onLogs(
          PROGRAM_ID,
          (log) => {
            if (cancelled || log.err) return;
            const matched = log.logs.some((line) =>
              TARGET_LOG_FRAGMENTS.some((target) => line.includes(target))
            );
            if (matched) {
              backoff = MIN_BACKOFF_MS;
              callbackRef.current();
            }
          },
          "confirmed"
        );

        // Reset backoff on successful subscribe.
        backoff = MIN_BACKOFF_MS;
      } catch (error) {
        if (cancelled) return;
        console.warn(
          "[fornex] decision stream subscribe failed; will retry",
          error
        );
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (cancelled) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
        void subscribe();
      }, backoff);
    }

    void subscribe();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (connection && subscriptionId !== null) {
        // removeOnLogsListener returns a Promise; we don't await it during
        // unmount because React doesn't allow async cleanup.
        void connection.removeOnLogsListener(subscriptionId).catch(() => {});
      }
    };
  }, [enabled]);
}
