// Names the file a recorded request is stored under, in the demo build and in
// the script that records it: a hash of the normalized URL and POST body.
export async function requestKey(url: string, body?: string): Promise<string> {
  const text = `${new URL(url).href}\n${body ?? ""}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Where `pnpm build-demo` puts a recording, relative to the page. */
export const recordingPath = (key: string) => `demo/r/${key}.json`;
