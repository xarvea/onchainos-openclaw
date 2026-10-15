import type { MetadataStorage } from '@micow/application';

/**
 * Metadata storage implementations.
 *
 * - {@link InlineJsonStorage} embeds the JSON in a `data:` URI. No network, no
 *   secrets — ideal for devnet/local and for tests. NOT for production (wallets
 *   and explorers truncate huge data URIs and it wastes on-chain space).
 * - {@link HttpStorage} POSTs to a configurable upload endpoint (e.g. your own
 *   pinning service) and expects `{ uri }` back. Provider-agnostic escape hatch.
 * - {@link PinataStorage} pins images + metadata JSON to IPFS via Pinata's REST
 *   API (no SDK dependency) and returns gateway-resolved `https://…/ipfs/<cid>`
 *   URIs. This is the default durable provider for MICOW.
 *
 * All are framework-free and satisfy the application-layer `MetadataStorage`
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
      'InlineJsonStorage.putBytes: images require a real host — use PinataStorage or HttpStorage in production',
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

export interface PinataStorageOptions {
  /** Pinata JWT (Bearer). Server-only — never expose to the browser. */
  jwt: string;
  /** Public IPFS gateway base used to build read URLs. Default: Pinata gateway. */
  gateway?: string;
  /**
   * Optional folder/name prefix applied to pin names. Purely cosmetic (shows in
   * the Pinata dashboard); it does NOT affect the CID or the returned URI.
   */
  namePrefix?: string;
}

/**
 * Durable metadata storage on IPFS via Pinata's REST API.
 *
 * Why REST + `fetch` instead of the Pinata SDK: zero new dependencies, works in
 * Node and edge runtimes, and mirrors {@link HttpStorage} so it is trivial to
 * mock in tests. Images (`pinFileToIPFS`, multipart) and metadata JSON
 * (`pinJSONToIPFS`) are pinned, and the returned URI is resolved through a
 * public gateway so wallets/explorers can fetch it directly.
 *
 * Contract notes:
 * - `putBytes` returns an image URI (e.g. `https://gateway.pinata.cloud/ipfs/<cid>`).
 * - `putJson` returns a metadata URI; callers already embed the image URI from
 *   `putBytes` inside the JSON before pinning it.
 * - Failures throw (never a bogus URI) — a launch that persists a broken URI
 *   would mint un-metadata'd assets on-chain.
 */
export class PinataStorage implements MetadataStorage {
  private readonly gateway: string;
  private readonly namePrefix: string;

  constructor(private readonly opts: PinataStorageOptions) {
    if (!opts.jwt) throw new Error('PinataStorage: jwt is required');
    // Normalise: strip a trailing slash so joins are predictable.
    this.gateway = (opts.gateway ?? 'https://gateway.pinata.cloud').replace(/\/+$/, '');
    this.namePrefix = opts.namePrefix ? `${opts.namePrefix}-` : '';
  }

  /** Build the browser-facing URI for a CID through the configured gateway. */
  private uriFor(cid: string): string {
    return `${this.gateway}/ipfs/${cid}`;
  }

  private async readCid(res: Response, op: string): Promise<string> {
    if (!res.ok) {
      // Surface the status only — never echo the response body (could be large
      // or contain hints). The JWT is never logged.
      throw new Error(`PinataStorage.${op} failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as { IpfsHash?: string };
    if (!json.IpfsHash) throw new Error(`PinataStorage.${op}: response missing IpfsHash`);
    return json.IpfsHash;
  }

  async putJson(json: Record<string, unknown>): Promise<{ uri: string }> {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.opts.jwt}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        pinataContent: json,
        pinataMetadata: { name: `${this.namePrefix}metadata.json` },
      }),
    });
    const cid = await this.readCid(res, 'putJson');
    return { uri: this.uriFor(cid) };
  }

  async putBytes(
    data: Uint8Array,
    opts: { contentType: string; fileName?: string },
  ): Promise<{ uri: string }> {
    const form = new FormData();
    // Copy into a fresh Uint8Array so the Blob owns its bytes (some runtimes
    // retain a view into a larger buffer otherwise).
    const bytes = new Uint8Array(data);
    form.append('file', new Blob([bytes], { type: opts.contentType }), opts.fileName ?? 'file');
    form.append(
      'pinataMetadata',
      JSON.stringify({ name: `${this.namePrefix}${opts.fileName ?? 'file'}` }),
    );

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.opts.jwt}` },
      body: form,
    });
    const cid = await this.readCid(res, 'putBytes');
    return { uri: this.uriFor(cid) };
  }
}

/**
 * Storage driver selector — the composition-root seam for metadata storage.
 *
 * `inline` (default) embeds JSON as a `data:` URI and has no durable bytes host
 * (dev/test only). `http` posts to a caller-provided endpoint. `pinata` pins to
 * IPFS. Keeping the selection here means scripts/DI roots never `switch` on the
 * env var themselves, and the application layer stays ignorant of providers.
 */
export type StorageDriver = 'inline' | 'http' | 'pinata';

export interface StorageConfig {
  driver: StorageDriver;
  /** driver=http */
  endpoint?: string;
  token?: string;
  /** driver=pinata */
  pinataJwt?: string;
  gateway?: string;
  /** Optional pin-name prefix (pinata). */
  namePrefix?: string;
}

/**
 * Build the {@link MetadataStorage} for the configured driver, failing loudly on
 * a missing required credential rather than silently degrading to `inline`
 * (which would mint assets with non-durable `data:` URIs).
 */
export function createMetadataStorage(cfg: StorageConfig): MetadataStorage {
  switch (cfg.driver) {
    case 'inline':
      return new InlineJsonStorage();
    case 'http':
      if (!cfg.endpoint) {
        throw new Error('createMetadataStorage: driver "http" requires endpoint');
      }
      return new HttpStorage({ endpoint: cfg.endpoint, token: cfg.token });
    case 'pinata':
      if (!cfg.pinataJwt) {
        throw new Error('createMetadataStorage: driver "pinata" requires pinataJwt (PINATA_JWT)');
      }
      return new PinataStorage({
        jwt: cfg.pinataJwt,
        gateway: cfg.gateway,
        namePrefix: cfg.namePrefix,
      });
    default: {
      // Exhaustiveness check: an unknown driver is a config error, not a crash.
      const never: never = cfg.driver;
      throw new Error(`createMetadataStorage: unknown driver ${String(never)}`);
    }
  }
}
