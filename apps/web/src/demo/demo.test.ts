import { describe, expect, it } from "vitest";
import { searchExamples } from "./adapter";
import { requestKey } from "./key";
import { ChunkedSource, manifestUrl, type ChunkManifest } from "./tiles";

describe("chunked tiles", () => {
  // 10 bytes 0…9 in chunks of 4: [0 1 2 3] [4 5 6 7] [8 9]
  const bytes = Uint8Array.from({ length: 10 }, (_, i) => i);
  const manifest: ChunkManifest = { size: 10, chunkSize: 4, encoding: "base64", chunks: ["a.txt", "b.txt", "c.txt"] };
  const fetched: string[] = [];
  const source = new ChunkedSource("https://host/tiles/sf.pmtiles", async (url) => {
    fetched.push(url);
    if (url === manifestUrl("https://host/tiles/sf.pmtiles")) return new TextEncoder().encode(JSON.stringify(manifest)).buffer as ArrayBuffer;
    const i = manifest.chunks.findIndex((name) => url === `https://host/tiles/${name}`);
    return new TextEncoder().encode(btoa(String.fromCharCode(...bytes.slice(i * 4, i * 4 + 4)))).buffer as ArrayBuffer;
  });
  const read = async (offset: number, length: number) => [...new Uint8Array((await source.getBytes(offset, length)).data)];

  it("reads ranges inside one chunk, across chunks and past the end", async () => {
    expect(await read(1, 2)).toEqual([1, 2]);
    expect(await read(3, 6)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(await read(8, 16_384)).toEqual([8, 9]);
  });

  it("fetches the manifest and each chunk once", () => {
    expect(fetched.filter((url) => url.endsWith(".chunks.json"))).toHaveLength(1);
    expect(fetched.filter((url) => url.endsWith(".txt")).sort()).toEqual(manifest.chunks.map((name) => `https://host/tiles/${name}`));
  });
});

describe("demo search", () => {
  it("finds example lots by address prefix, numbered streets and ranges included", () => {
    expect(searchExamples("667 hamp").map((m) => m.blklot)).toEqual(["4025007"]);
    expect(searchExamples("752 4th av").map((m) => m.blklot)).toEqual(["1646023"]);
    expect(searchExamples("772 Francisco").map((m) => m.blklot)).toEqual(["0044030"]);
    expect(searchExamples("100 Main St")).toEqual([]);
  });
});

describe("request keys", () => {
  it("are stable, ignore URL spelling differences and include the POST body", async () => {
    const key = await requestKey("https://data.sf.gov/resource/x.json?$where=a=1");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(await requestKey("https://DATA.sf.gov/resource/x.json?$where=a=1")).toBe(key);
    expect(await requestKey("https://data.sf.gov/resource/x.json?$where=a=1", "body")).not.toBe(key);
  });
});
