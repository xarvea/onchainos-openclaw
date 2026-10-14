import { describe, expect, it } from 'vitest';

import { dasAssetToDomain, dasInterfaceToStandard, type DasAsset } from './das';

const MINT = 'So11111111111111111111111111111111111111112';
const OWNER = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';

function das(overrides: Partial<DasAsset> = {}): DasAsset {
  return { id: MINT, ...overrides };
}

describe('dasInterfaceToStandard', () => {
  it('maps DAS interface strings to domain standards', () => {
    expect(dasInterfaceToStandard('MplCoreAsset')).toBe('core');
    expect(dasInterfaceToStandard('V1_NFT')).toBe('token-metadata');
    expect(dasInterfaceToStandard('ProgrammableNFT')).toBe('token-metadata');
    expect(dasInterfaceToStandard('CompressedNFT')).toBe('compressed');
    expect(dasInterfaceToStandard(undefined)).toBe('token-metadata');
  });
});

describe('dasAssetToDomain', () => {
  it('carries the off-chain metadata uri from json_uri (not an empty string)', () => {
    const asset = dasAssetToDomain(
      das({ content: { json_uri: 'https://arweave.net/meta.json', metadata: { name: 'Foo' } } }),
    );
    expect(asset.uri).toBe('https://arweave.net/meta.json');
    expect(asset.name).toBe('Foo');
  });

  it('prefers the original image file over the links thumbnail', () => {
    const asset = dasAssetToDomain(
      das({
        content: {
          links: { image: 'https://thumb/low.png' },
          files: [
            { uri: 'https://arweave.net/hi.png', mime: 'image/png' },
            { uri: 'https://arweave.net/meta.json', mime: 'application/json' },
          ],
        },
      }),
    );
    expect(asset.image).toBe('https://arweave.net/hi.png');
  });

  it('falls back to links.image when no image file is present', () => {
    const asset = dasAssetToDomain(das({ content: { links: { image: 'https://x/only.png' } } }));
    expect(asset.image).toBe('https://x/only.png');
  });

  it('takes ownership strictly from ownership.owner', () => {
    const asset = dasAssetToDomain(das({ ownership: { owner: OWNER, frozen: true } }));
    expect(asset.owner).toBe(OWNER);
    expect(asset.frozen).toBe(true);
  });

  it('maps collection grouping and creator', () => {
    const asset = dasAssetToDomain(
      das({
        ownership: { owner: OWNER },
        grouping: [{ group_key: 'collection', group_value: MINT }],
        creators: [{ address: OWNER, verified: true }],
      }),
    );
    expect(asset.collection).toBe(MINT);
    expect(asset.creator).toBe(OWNER);
  });
});
