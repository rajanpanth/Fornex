import { useEffect, useMemo, useState } from "react";

const CYCLE_MS = 15 * 60 * 1000;
const THINKING_MS = 15 * 1000;
const STORAGE_KEY = "fornex-agent-cycle-start";

export function useAgentCycle(onCycleComplete?: () => void) {
  const [now, setNow] = useState(Date.now());
  const [cycleStart, setCycleStart] = useState<number | null>(null);

  useEffect(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    const start = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    localStorage.setItem(STORAGE_KEY, String(start));
    setCycleStart(start);
  }, []);

  useEffect(() => {
    let previousCycle = Math.floor((Date.now() - (cycleStart ?? Date.now())) / CYCLE_MS);
    const id = setInterval(() => {
      const nextNow = Date.now();
      const nextCycle = Math.floor((nextNow - (cycleStart ?? nextNow)) / CYCLE_MS);
      if (nextCycle > previousCycle) {
        previousCycle = nextCycle;
        onCycleComplete?.();
      }
      setNow(nextNow);
    }, 1000);
    return () => clearInterval(id);
  }, [cycleStart, onCycleComplete]);

  return useMemo(() => {
    const start = cycleStart ?? now;
    const elapsed = Math.max(0, now - start);
    const cycleElapsed = elapsed % CYCLE_MS;
    const thinking = cycleElapsed < THINKING_MS && elapsed >= CYCLE_MS;
    const remaining = thinking ? 0 : CYCLE_MS - cycleElapsed;
    const minutes = Math.floor(remaining / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);

    return {
      thinking,
      progress: cycleElapsed / CYCLE_MS,
      label: thinking
        ? "THINKING..."
        : `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`,
    };
  }, [cycleStart, now]);
}
