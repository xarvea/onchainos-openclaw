import type { MetadataStorage } from '@micow/application';

/**
 * Metadata storage implementations.
 *
 * - {@link InlineJsonStorage} embeds the JSON in a `data:` URI. No network, no
 *   secrets — ideal for devnet/local and for tests. NOT for production (wallets
 *   and explorers truncate huge data URIs and it wastes on-chain space).
 * - {@link HttpStorage} POSTs to a configurable upload endpoint (e.g. an Irys
 *   bundler, ArDrive, or your own pinning service) and expects `{ uri }` back.
 *   This keeps the heavy `@irys/upload` SDK out of the core package and lets the
 *   deployment choose its provider; wire the real Irys SDK in a thin adapter if
 *   you need funding/settlement logic.
 *
 * Both are framework-free and satisfy the application-layer `MetadataStorage`
 * port, so the launch use case never imports a storage SDK directly.
 */

/** Encode bytes as a base64 string without depending on Node's Buffer type. */
function toBase64(bytes: Uint8Array): string {
  // `btoa` exists in Node 16+ and browsers; accept it as the common denominator.
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export class InlineJsonStorage implements MetadataStorage {
  private readonly base: string;

  constructor(opts: { basePrefix?: string } = {}) {
    // `data:application/json;base64,` works in Fetch/Explorer contexts; the
    // prefix is configurable so callers can use a custom scheme if needed.
    this.base = opts.basePrefix ?? 'data:application/json;base64,';
  }

  async putJson(json: Record<string, unknown>): Promise<{ uri: string }> {
    const encoded = toBase64(new TextEncoder().encode(JSON.stringify(json)));
    return { uri: `${this.base}${encoded}` };
  }

  async putBytes(
    _data: Uint8Array,
    _opts: { contentType: string; fileName?: string },
  ): Promise<{ uri: string }> {
    // Without a real host we cannot mint a durable image URI. Returning a bogus
    // one would silently produce broken assets, so we fail loudly instead.
    throw new Error(
      'InlineJsonStorage.putBytes: images require a real host — use HttpStorage or IrysStorage in production',
    );
  }
}

export interface HttpStorageOptions {
  /** Endpoint that accepts an upload and returns `{ uri }`. */
  endpoint: string;
  /** Optional bearer token / API key sent as `Authorization`. */
  token?: string;
  /** Optional extra headers. */
  headers?: Record<string, string>;
}

/**
 * Minimal HTTP storage client. The endpoint contract is intentionally simple:
 * POST the body (JSON or bytes) and receive `{ uri }`. Provider-specific
 * funding/settlement is out of scope — wrap the provider's SDK behind this if
 * you need it.
 */
export class HttpStorage implements MetadataStorage {
  constructor(private readonly opts: HttpStorageOptions) {
    if (!opts.endpoint) throw new Error('HttpStorage: endpoint is required');
  }

  private async post(body: RequestInit['body'], contentType: string): Promise<{ uri: string }> {
    const res = await fetch(this.opts.endpoint, {
      method: 'POST',
      headers: {
        'content-type': contentType,
        ...(this.opts.token ? { authorization: `Bearer ${this.opts.token}` } : {}),
        ...this.opts.headers,
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`HttpStorage upload failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as { uri?: string };
    if (!json.uri) throw new Error('HttpStorage: response missing `uri`');
    return { uri: json.uri };
  }

  async putJson(json: Record<string, unknown>): Promise<{ uri: string }> {
    return this.post(JSON.stringify(json), 'application/json');
  }

  async putBytes(data: Uint8Array, opts: { contentType: string }): Promise<{ uri: string }> {
    return this.post(data as RequestInit['body'], opts.contentType);
  }
}
