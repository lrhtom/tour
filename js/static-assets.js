import { decodeBase64 } from './archive.js';

export async function readStaticAsset(request) {
  const url = new URL(new URL(request.url).pathname, location.origin);
  const { default: value } = await import(`${url.href}.js`);
  return { data: typeof value === 'string' ? decodeBase64(value) : value };
}
