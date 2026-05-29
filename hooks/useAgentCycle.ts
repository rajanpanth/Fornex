import { useEffect, useMemo, useState } from "react";

/**
 * Brain interval - must match LOOP_MS in `agent/src/index.ts`.
 * If you change this, update HeroLiveTicker's CYCLE_MS too.
 */
const CYCLE_MS = 15 * 60 * 1000;
const THINKING_MS = 15 * 1000;
const STORAGE_KEY = "fornex-agent-cycle-start";

/**
 * useAgentCycle - drives the dashboard's "Next cycle" countdown.
 *
 * Truth source priority:
 *   1. `lastDecisionTimestampMs` - the on-chain timestamp of the most recent
 *      decision (× 1000 since chain stores seconds). This makes every UI
 *      surface - topbar pill, right-column "Next cycle", and the hero ticker -
 *      tick in lockstep with reality, regardless of which tab/device is
 *      looking. THIS is what you want for hackathon demos.
 *
 *   2. localStorage `fornex-agent-cycle-start` (legacy fallback) - first time
 *      the page mounted, used only when no decision has been seen yet
 *      (cold-start, brand-new vault, RPC not available).
 *
 * `onCycleComplete` fires once each time the cycle window rolls over so the
 * dashboard can refetch decisions and the equity curve.
 */
export function useAgentCycle(
  onCycleComplete?: () => void,
  lastDecisionTimestampMs?: number | null
) {
  const [now, setNow] = useState(Date.now());
  const [legacyStart, setLegacyStart] = useState<number | null>(null);

  useEffect(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    const start = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    localStorage.setItem(STORAGE_KEY, String(start));
    setLegacyStart(start);
  }, []);

  // Resolve the anchor: prefer the on-chain timestamp; fall back to legacy.
  const anchor = lastDecisionTimestampMs ?? legacyStart ?? now;

  useEffect(() => {
    let previousCycle = Math.floor((Date.now() - anchor) / CYCLE_MS);
    const id = setInterval(() => {
      const nextNow = Date.now();
      const nextCycle = Math.floor((nextNow - anchor) / CYCLE_MS);
      if (nextCycle > previousCycle) {
        previousCycle = nextCycle;
        onCycleComplete?.();
      }
      setNow(nextNow);
    }, 1000);
    return () => clearInterval(id);
  }, [anchor, onCycleComplete]);

  return useMemo(() => {
    const elapsed = Math.max(0, now - anchor);
    const cycleElapsed = elapsed % CYCLE_MS;
    // "Thinking" is the brief window after a cycle boundary where the agent
    // is calling the LLM and posting on-chain. The decision PDA usually
    // appears within ~15 s.
    const thinking = cycleElapsed < THINKING_MS && elapsed >= CYCLE_MS;
    const remaining = thinking ? 0 : CYCLE_MS - cycleElapsed;
    const minutes = Math.floor(remaining / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);

    return {
      thinking,
      progress: cycleElapsed / CYCLE_MS,
      remainingMs: remaining,
      label: thinking
        ? "THINKING..."
        : `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`,
    };
  }, [anchor, now]);
}
