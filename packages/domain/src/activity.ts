import type { Lamports, PublicKeyString, TxSignature } from './primitives';

/** Activity types ingested from chain / Helius webhooks (read model). */
export const ActivityType = {
  MINT: 'MINT',
  LIST: 'LIST',
  SALE: 'SALE',
  TRANSFER: 'TRANSFER',
  CANCEL: 'CANCEL',
} as const;

export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export interface Activity {
  readonly id: string;
  readonly type: ActivityType;
  readonly asset: PublicKeyString;
  readonly collection: PublicKeyString | null;
  readonly from: PublicKeyString | null;
  readonly to: PublicKeyString | null;
  readonly price: Lamports | null;
  readonly txSignature: TxSignature;
  readonly blockTime: Date;
  readonly slot: bigint;
}
