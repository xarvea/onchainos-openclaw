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

  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl(network),
    [network],
  );

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
