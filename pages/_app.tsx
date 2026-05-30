import type { AppProps } from "next/app";
import Head from "next/head";
import { useMemo } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import "../styles/globals.css";

// Self-host the fonts at build time. This removes the render-blocking
// Google Fonts @import (which caused a fallback-font flash on Vercel that
// localhost never showed because Inter was installed system-wide). Both
// are variable fonts, so omitting `weight` gives the full 100-900 range
// the design uses (incl. 800/900 headlines).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const SolanaConnectionProvider = ConnectionProvider as any;
const SolanaWalletProvider = WalletProvider as any;
const SolanaWalletModalProvider = WalletModalProvider as any;

export default function App({ Component, pageProps }: AppProps) {
  const endpoint =
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://api.devnet.solana.com";
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <>
      <Head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </Head>
      <div className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <SolanaConnectionProvider endpoint={endpoint}>
          <SolanaWalletProvider wallets={wallets} autoConnect>
            <SolanaWalletModalProvider>
              <Component {...pageProps} />
            </SolanaWalletModalProvider>
          </SolanaWalletProvider>
        </SolanaConnectionProvider>
      </div>
    </>
  );
}
