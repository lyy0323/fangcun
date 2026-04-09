/**
 * 阿里云 CDN Type A 鉴权 URL 签名
 *
 * 参考: literatureCollection_dev_bak/gxs_cipher.py
 * 格式: {url}?auth_key={timestamp}-{rand}-{uid}-{md5}
 * md5  = md5("{uri_path}-{timestamp}-{rand}-{uid}-{key}")
 */

// ============================================================================
// 轻量 MD5 实现 (RFC 1321)
// ============================================================================

function md5(str: string): string {
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  // UTF-8 encode
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
    else { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
  }

  // Padding
  const bitLenLo = (bytes.length * 8) >>> 0;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // Append 64-bit length in little-endian (upper 32 bits always 0 for our use case)
  for (let i = 0; i < 4; i++) bytes.push((bitLenLo >>> (i * 8)) & 0xff);
  bytes.push(0, 0, 0, 0);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = bytes[offset + j * 4] | (bytes[offset + j * 4 + 1] << 8) |
        (bytes[offset + j * 4 + 2] << 16) | (bytes[offset + j * 4 + 3] << 24);
    }

    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16)      { F = (B & C) | (~B & D);   g = i; }
      else if (i < 32) { F = (D & B) | (~D & C);   g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D;             g = (3 * i + 5) % 16; }
      else             { F = C ^ (B | ~D);           g = (7 * i) % 16; }

      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }

  const hex = (n: number) => {
    let r = '';
    for (let i = 0; i < 4; i++) r += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return r;
  };
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

// ============================================================================
// CDN URL 签名
// ============================================================================

/**
 * 生成阿里云 CDN Type A 鉴权 URL
 */
export function signCdnUrl(originalUrl: string, privateKey: string, expireSec: number): string {
  const fullPath = new URL(originalUrl).pathname;
  const key = privateKey.trim();

  const timestamp = Math.floor(Date.now() / 1000) + expireSec;
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const uid = '0';

  const sString = `${fullPath}-${timestamp}-${rand}-${uid}-${key}`;
  const hash = md5(sString);
  const authKey = `${timestamp}-${rand}-${uid}-${hash}`;

  return originalUrl.includes('?')
    ? `${originalUrl}&auth_key=${authKey}`
    : `${originalUrl}?auth_key=${authKey}`;
}
