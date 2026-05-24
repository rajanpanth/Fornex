import { useEffect, useRef, useState } from "react";

const STATS = [
  { target: 47, label: "Total Decisions", suffix: "" },
  { target: 67, label: "Win Rate", suffix: "%" },
  { target: 10.43, label: "Vault NAV", suffix: " SOL", decimals: 2 },
  { target: 96, label: "Agent Uptime", suffix: " hrs" },
  { target: null, label: "On-Chain Forever", display: "∞" },
];

function AnimatedNumber({
  target,
  suffix,
  decimals = 0,
  display,
  animate,
}: {
  target: number | null;
  suffix: string;
  decimals?: number;
  display?: string;
  animate: boolean;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!animate || target === null) return;
    const duration = 1200;
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, target]);

  if (display) return <>{display}</>;
  if (target === null) return <>—</>;

  const formatted =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();

  return (
    <>
      {formatted}
      {suffix}
    </>
  );
}

export default function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="stats-bar" ref={ref}>
      <div className="stats-bar-inner">
        {STATS.map((s) => (
          <div className="stats-bar-item" key={s.label}>
            <span className="stats-bar-value">
              <AnimatedNumber
                target={s.target}
                suffix={s.suffix || ""}
                decimals={(s as any).decimals}
                display={(s as any).display}
                animate={visible}
              />
            </span>
            <span className="stats-bar-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
