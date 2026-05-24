const STEPS = [
  {
    number: "01",
    icon: "💰",
    title: "Deposit SOL",
    desc: "Connect your wallet and deposit any amount of SOL into the Fornex vault. You receive shares proportional to the vault's current NAV.",
  },
  {
    number: "02",
    icon: "🧠",
    title: "Agents Vote Every 15min",
    desc: "Three AI agents — BULL, BEAR, and ZEN — analyze market conditions independently and vote on position direction, leverage, and sizing.",
  },
  {
    number: "03",
    icon: "🔗",
    title: "On-Chain Forever",
    desc: "Every vote, every argument, and the consensus decision is stored permanently on the Solana blockchain. Fully auditable. Zero black boxes.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section-padding">
      <div className="section-center" style={{ textAlign: "center" }}>
        <div className="section-label">HOW IT WORKS</div>
        <h2 className="section-title">
          From deposit to autonomous trading in seconds
        </h2>

        <div className="hiw-grid">
          {STEPS.map((step, i) => (
            <div key={step.number} style={{ display: "contents" }}>
              {i > 0 && <div className="hiw-arrow">→</div>}
              <div className="hiw-card">
                <div className="hiw-number">{step.number}</div>
                <span className="hiw-icon">{step.icon}</span>
                <h3 className="hiw-card-title">{step.title}</h3>
                <p className="hiw-card-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
