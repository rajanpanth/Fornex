import type { AppProps } from "next/app";
import Head from "next/head";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import "../styles/globals.css";

const SolanaConnectionProvider = ConnectionProvider as any;
const SolanaWalletProvider = WalletProvider as any;
const SolanaWalletModalProvider = WalletModalProvider as any;

export default function App({ Component, pageProps }: AppProps) {
  const endpoint =
    process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
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
      <SolanaConnectionProvider endpoint={endpoint}>
        <SolanaWalletProvider wallets={wallets} autoConnect>
          <SolanaWalletModalProvider>
            <Component {...pageProps} />
          </SolanaWalletModalProvider>
        </SolanaWalletProvider>
      </SolanaConnectionProvider>
    </>
  );
}
