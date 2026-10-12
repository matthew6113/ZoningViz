import type { RangeResponse, Source } from "pmtiles";

// The demo host answers whole files only (no HTTP range requests), caps the
// size of each and serves no raw binary files, so `pnpm build-demo` publishes
// the tiles as fixed-size base64 text chunks plus a small manifest; this source
// reads byte ranges back from them.

export interface ChunkManifest {
  /** Bytes in the whole archive. */
  size: number;
  /** Bytes per chunk before encoding (the last one may be shorter). */
  chunkSize: number;
  encoding: "base64" | "raw";
  chunks: string[];
}

export const manifestUrl = (tilesUrl: string) => `${tilesUrl}.chunks.json`;

export class ChunkedSource implements Source {
  private manifest: Promise<ChunkManifest> | null = null;
  private readonly chunks = new Map<number, Promise<Uint8Array>>();

  constructor(
    private readonly url: string,
    private readonly fetchBytes: (url: string) => Promise<ArrayBuffer> = defaultFetchBytes,
  ) {}

  getKey(): string {
    return this.url;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const manifest = await (this.manifest ??= this.fetchBytes(manifestUrl(this.url)).then(
      (bytes) => JSON.parse(new TextDecoder().decode(bytes)) as ChunkManifest,
    ));
    const end = Math.min(offset + length, manifest.size);
    const out = new Uint8Array(Math.max(0, end - offset));
    const first = Math.floor(offset / manifest.chunkSize);
    for (let i = first; i * manifest.chunkSize < end; i++) {
      const chunk = await this.chunk(manifest, i);
      const start = i * manifest.chunkSize;
      const from = Math.max(offset, start);
      const to = Math.min(end, start + chunk.length);
      out.set(chunk.subarray(from - start, to - start), from - offset);
    }
    return { data: out.buffer };
  }

  private chunk(manifest: ChunkManifest, index: number): Promise<Uint8Array> {
    let pending = this.chunks.get(index);
    if (!pending) {
      const url = new URL(manifest.chunks[index]!, this.url).href;
      pending = this.fetchBytes(url).then((bytes) => (manifest.encoding === "base64" ? fromBase64(bytes) : new Uint8Array(bytes)));
      // A failed chunk is fetched again next time.
      pending.catch(() => this.chunks.delete(index));
      this.chunks.set(index, pending);
    }
    return pending;
  }
}

function fromBase64(text: ArrayBuffer): Uint8Array {
  const binary = atob(new TextDecoder().decode(text));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function defaultFetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.arrayBuffer();
}
