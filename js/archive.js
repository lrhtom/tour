// PMTiles source over small ordinary static files. HTTP Range is optional:
// if a host ignores Range, at most one 4 MiB part is downloaded and cached.
export class ChunkedArchiveSource {
  constructor(manifest, base, { fetcher = fetch, maxCachedParts = 8 } = {}) {
    this.manifest = manifest;
    this.base = new URL(base);
    this.fetcher = fetcher.bind(globalThis);
    this.parts = new Map();
    this.maxCachedParts = maxCachedParts;
    this.key = new URL(`uk-${manifest.sha256}.pmtiles`, this.base).href;
  }
  getKey() { return this.key; }
  async part(index, start, end, signal) {
    if (this.parts.has(index)) {
      const data = this.parts.get(index);
      this.parts.delete(index); this.parts.set(index, data);
      return data.slice(start, end + 1);
    }
    const encoded = this.manifest.encoding === 'base64-js';
    const partSize = Math.min(this.manifest.blockSize, this.manifest.size - index * this.manifest.blockSize);
    const encodedStart = Math.floor(start / 3) * 4;
    const encodedEnd = Math.min(Math.ceil((end + 1) / 3) * 4, Math.ceil(partSize / 3) * 4) - 1;
    const requestStart = encoded ? this.manifest.prefixBytes + encodedStart : start;
    const requestEnd = encoded ? this.manifest.prefixBytes + encodedEnd : end;
    const response = await this.fetcher(new URL(this.manifest.files[index], this.base), { headers: { Range: `bytes=${requestStart}-${requestEnd}` }, signal });
    if (!response.ok) throw new Error(`Map part ${index}: HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    if (response.status === 206) {
      const expected = `bytes ${requestStart}-${requestEnd}/`;
      if (!response.headers.get('content-range')?.startsWith(expected) || buffer.byteLength !== requestEnd - requestStart + 1) throw new Error('Invalid map Range response.');
      if (encoded) {
        const decoded = decodeBase64(new TextDecoder().decode(buffer));
        const trim = start - Math.floor(start / 3) * 3;
        return decoded.slice(trim, trim + end - start + 1);
      }
      return buffer;
    }
    let bytes = buffer;
    if (encoded && response.status === 200) {
      const text = new TextDecoder().decode(buffer).trim();
      if (!text.startsWith('export default "') || !text.endsWith('";')) throw new Error('Invalid static map file.');
      bytes = decodeBase64(text.slice(this.manifest.prefixBytes, -2));
    }
    if (response.status !== 200 || bytes.byteLength !== partSize) throw new Error('Invalid map part length.');
    this.parts.set(index, bytes);
    while (this.parts.size > this.maxCachedParts) this.parts.delete(this.parts.keys().next().value);
    return bytes.slice(start, end + 1);
  }
  async getBytes(offset, length, signal) {
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 1 || offset + length > this.manifest.size) throw new Error('Map read outside archive.');
    const { blockSize } = this.manifest;
    const first = Math.floor(offset / blockSize), last = Math.floor((offset + length - 1) / blockSize);
    const buffers = await Promise.all(Array.from({ length: last - first + 1 }, (_, i) => {
      const index = first + i;
      return this.part(index, Math.max(0, offset - index * blockSize), Math.min(blockSize - 1, offset + length - 1 - index * blockSize), signal);
    }));
    const bytes = new Uint8Array(length);
    let cursor = 0;
    for (const buffer of buffers) { bytes.set(new Uint8Array(buffer), cursor); cursor += buffer.byteLength; }
    return { data: bytes.buffer, etag: this.manifest.sha256, cacheControl: 'public, max-age=31536000, immutable' };
  }
}
export function decodeBase64(text) {
  const binary = atob(text);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
  return data.buffer;
}
