import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '@/lib/og';
import { getCollection } from '@/lib/read-model';

export const alt = 'Koleksi NFT di MICOW';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 300;

interface ImageProps {
  params: Promise<{ address: string }>;
}

/** Per-collection Open Graph card: name + verified badge when known. */
export default async function CollectionOpengraphImage({ params }: ImageProps) {
  const { address } = await params;
  const short = `${address.slice(0, 4)}…${address.slice(-4)}`;

  let name = 'Collection';
  let verified = false;
  try {
    const { items } = await getCollection(address);
    const collection = items[0] ?? null;
    if (collection?.name) name = collection.name;
    verified = Boolean(collection?.verified);
  } catch {
    // Read model unavailable — fall back to the address only. Never fail the OG image.
  }

  return ogCard({
    title: name,
    subtitle: address,
    badge: verified ? `✓ ${short}` : short,
  });
}
