import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpStorage, InlineJsonStorage, PinataStorage } from './storage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InlineJsonStorage', () => {
  it('encodes JSON round-trippably as a data URI', async () => {
    const storage = new InlineJsonStorage();
    const { uri } = await storage.putJson({ name: 'Cebong', n: 1 });
    expect(uri.startsWith('data:application/json;base64,')).toBe(true);

    const b64 = uri.slice('data:application/json;base64,'.length);
    const decoded = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    expect(decoded).toEqual({ name: 'Cebong', n: 1 });
  });

  it('fails loudly on putBytes instead of returning a broken image URI', async () => {
    const storage = new InlineJsonStorage();
    await expect(
      storage.putBytes(new Uint8Array([1]), { contentType: 'image/png' }),
    ).rejects.toThrow(/real host/);
  });
});

describe('HttpStorage', () => {
  it('POSTs JSON and returns the uri from the endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ uri: 'ar://abc' }) }) as Response),
    );
    const storage = new HttpStorage({ endpoint: 'https://upload.test/x', token: 'k' });
    const out = await storage.putJson({ a: 1 });
    expect(out.uri).toBe('ar://abc');

    const call = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(call?.[0]).toBe('https://upload.test/x');
    expect((call?.[1].headers as Record<string, string>).authorization).toBe('Bearer k');
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 }) as Response),
    );
    const storage = new HttpStorage({ endpoint: 'https://upload.test/x' });
    await expect(storage.putJson({})).rejects.toThrow(/HTTP 500/);
  });

  it('throws when the response has no uri', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response),
    );
    const storage = new HttpStorage({ endpoint: 'https://upload.test/x' });
    await expect(storage.putJson({})).rejects.toThrow(/missing `uri`/);
  });

  it('rejects construction without an endpoint', () => {
    expect(() => new HttpStorage({ endpoint: '' })).toThrow(/endpoint is required/);
  });
});

describe('PinataStorage', () => {
  const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

  it('rejects construction without a jwt', () => {
    expect(() => new PinataStorage({ jwt: '' })).toThrow(/jwt is required/);
  });

  it('pins JSON and returns a gateway-resolved uri', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({ ok: true, status: 200, json: async () => ({ IpfsHash: CID }) }) as Response,
      ),
    );
    const storage = new PinataStorage({ jwt: 'jwt-token' });
    const { uri } = await storage.putJson({ name: 'Cebong' });
    expect(uri).toBe(`https://gateway.pinata.cloud/ipfs/${CID}`);

    const call = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(call?.[0]).toBe('https://api.pinata.cloud/pinning/pinJSONToIPFS');
    expect((call?.[1].headers as Record<string, string>).authorization).toBe('Bearer jwt-token');
    const body = JSON.parse(String(call?.[1].body));
    expect(body.pinataContent).toEqual({ name: 'Cebong' });
  });

  it('pins bytes as multipart and honours a custom gateway', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({ ok: true, status: 200, json: async () => ({ IpfsHash: CID }) }) as Response,
      ),
    );
    const storage = new PinataStorage({
      jwt: 'jwt-token',
      gateway: 'https://ipfs.io/', // trailing slash must be normalised
    });
    const { uri } = await storage.putBytes(new Uint8Array([1, 2, 3]), {
      contentType: 'image/png',
      fileName: '0.png',
    });
    expect(uri).toBe(`https://ipfs.io/ipfs/${CID}`);

    const call = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(call?.[0]).toBe('https://api.pinata.cloud/pinning/pinFileToIPFS');
    expect(call?.[1].body).toBeInstanceOf(FormData);
  });

  it('throws on a non-ok response (and never echoes the body)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response),
    );
    const storage = new PinataStorage({ jwt: 'bad' });
    await expect(storage.putJson({})).rejects.toThrow(/HTTP 401/);
  });

  it('throws when the response has no IpfsHash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response),
    );
    const storage = new PinataStorage({ jwt: 'jwt-token' });
    await expect(storage.putJson({})).rejects.toThrow(/missing IpfsHash/);
  });
});
