import Link from "next/link";

export default function Nav({ isApp = false }: { isApp?: boolean }) {
  if (isApp) return null; // App page has its own topbar

  return (
    <nav className="landing-nav">
      <Link href="/" className="nav-logo">
        FORNEX
      </Link>

      <div className="nav-links">
        <a href="#how-it-works">How it works</a>
        <a href="#agents">Agents</a>
        <a href="#on-chain">On-Chain</a>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
        </a>
      </div>

      <Link href="/app" className="nav-cta">
        Launch App
      </Link>
    </nav>
  );
}
