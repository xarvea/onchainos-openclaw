export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta';

export const CLUSTER_RPC_DEFAULTS: Record<SolanaCluster, string> = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};

/** Well-known program IDs used by MICOW (all public, open standards). */
export const PROGRAM_IDS = {
  metaplexCore: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
  tokenMetadata: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  bubblegum: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY',
  candyMachineV3: 'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR',
  auctionHouse: 'hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk',
} as const;

export function resolveRpcUrl(cluster: SolanaCluster, override?: string): string {
  return override ?? CLUSTER_RPC_DEFAULTS[cluster];
}
