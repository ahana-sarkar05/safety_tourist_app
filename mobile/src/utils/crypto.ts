function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function ch(x: number, y: number, z: number): number {
  return (x & y) ^ (~x & z);
}

function maj(x: number, y: number, z: number): number {
  return (x & y) ^ (x & z) ^ (y & z);
}

function sigma0(x: number): number {
  return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
}

function sigma1(x: number): number {
  return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
}

function gamma0(x: number): number {
  return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
}

function gamma1(x: number): number {
  return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
}

const K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

export function sha256(str: string): string {
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(
        0xe0 | (charcode >> 12),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  const bitLen = utf8.length * 8;
  utf8.push(0x80);

  while ((utf8.length % 64) !== 56) {
    utf8.push(0x00);
  }

  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  for (let i = 3; i >= 0; i--) utf8.push((highBits >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) utf8.push((lowBits >>> (i * 8)) & 0xff);

  let a = 0x6a09e667;
  let b = 0xbb67ae85;
  let c = 0x3c6ef372;
  let d = 0xa54ff53a;
  let e = 0x510e527f;
  let f = 0x9b05688c;
  let g = 0x1f83d9ab;
  let h = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let i = 0; i < utf8.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] =
        (utf8[i + t * 4] << 24) |
        (utf8[i + t * 4 + 1] << 16) |
        (utf8[i + t * 4 + 2] << 8) |
        utf8[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      w[t] = (gamma1(w[t - 2]) + w[t - 7] + gamma0(w[t - 15]) + w[t - 16]) >>> 0;
    }

    let a_ = a;
    let b_ = b;
    let c_ = c;
    let d_ = d;
    let e_ = e;
    let f_ = f;
    let g_ = g;
    let h_ = h;

    for (let t = 0; t < 64; t++) {
      const T1 = (h_ + sigma1(e_) + ch(e_, f_, g_) + K[t] + w[t]) >>> 0;
      const T2 = (sigma0(a_) + maj(a_, b_, c_)) >>> 0;
      h_ = g_;
      g_ = f_;
      f_ = e_;
      e_ = (d_ + T1) >>> 0;
      d_ = c_;
      c_ = b_;
      b_ = a_;
      a_ = (T1 + T2) >>> 0;
    }

    a = (a + a_) >>> 0;
    b = (b + b_) >>> 0;
    c = (c + c_) >>> 0;
    d = (d + d_) >>> 0;
    e = (e + e_) >>> 0;
    f = (f + f_) >>> 0;
    g = (g + g_) >>> 0;
    h = (h + h_) >>> 0;
  }

  const toHex = (n: number) => n.toString(16).padStart(8, "0");
  return `0x${toHex(a)}${toHex(b)}${toHex(c)}${toHex(d)}${toHex(e)}${toHex(f)}${toHex(g)}${toHex(h)}`;
}

export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJsonStringify).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`
  );
  return "{" + pairs.join(",") + "}";
}

export function hashData(data: any): string {
  const canonical = typeof data === "string" ? data : canonicalJsonStringify(data);
  return sha256(canonical);
}
