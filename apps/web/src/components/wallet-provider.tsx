'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo, type ReactNode } from 'react';

import '@solana/wallet-adapter-react-ui/styles.css';

export function WalletProvider({ children }: { children: ReactNode }) {
  const network =
    (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as WalletAdapterNetwork) ??
    WalletAdapterNetwork.Devnet;

  const endpoint = useMemo(() => {
    // An empty/blank RPC URL must fall back to the public cluster RPC, not be
    // passed through — an empty string makes web3.js throw
    // "Endpoint URL must start with http: or https:" during prerender.
    const configured = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
    return configured && configured.length > 0 ? configured : clusterApiUrl(network);
  }, [network]);

  // Empty array => rely on Wallet Standard auto-detection (Phantom, Solflare, ...).
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
