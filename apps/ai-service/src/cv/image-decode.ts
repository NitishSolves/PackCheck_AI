import { deflateSync, inflateSync } from 'node:zlib';

export type DecodedImage = {
  width: number;
  height: number;
  orientationDegrees: number;
  pixels: Uint8Array | null;
  format: 'png' | 'jpeg' | 'webp' | 'unknown';
};

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readU32(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function pngPaeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

function unfilterPng(
  data: Buffer,
  width: number,
  height: number,
  bytesPerPixel: number,
): Buffer {
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(stride * height);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = data[src] ?? 0;
    src += 1;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = data[src + x] ?? 0;
      const left = x >= bytesPerPixel ? (out[rowStart + x - bytesPerPixel] ?? 0) : 0;
      const up = y > 0 ? (out[rowStart - stride + x] ?? 0) : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel ? (out[rowStart - stride + x - bytesPerPixel] ?? 0) : 0;
      let value = raw;
      switch (filter) {
        case 1:
          value = (raw + left) & 255;
          break;
        case 2:
          value = (raw + up) & 255;
          break;
        case 3:
          value = (raw + Math.floor((left + up) / 2)) & 255;
          break;
        case 4:
          value = (raw + pngPaeth(left, up, upLeft)) & 255;
          break;
        default:
          value = raw;
      }
      out[rowStart + x] = value;
    }
    src += stride;
  }
  return out;
}

function decodePng(bytes: Buffer): DecodedImage | null {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIG)) {
    return null;
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  let palette: Buffer | null = null;

  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) {
      break;
    }
    const chunk = bytes.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      width = readU32(chunk, 0);
      height = readU32(chunk, 4);
      bitDepth = chunk[8] ?? 0;
      colorType = chunk[9] ?? 0;
      const interlace = chunk[12] ?? 0;
      if (interlace !== 0 || bitDepth !== 8) {
        return { width, height, orientationDegrees: 0, pixels: null, format: 'png' };
      }
    } else if (type === 'PLTE') {
      palette = Buffer.from(chunk);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(chunk));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0) {
    return null;
  }

  let bytesPerPixel = 0;
  if (colorType === 0) {
    bytesPerPixel = 1;
  } else if (colorType === 2) {
    bytesPerPixel = 3;
  } else if (colorType === 3) {
    bytesPerPixel = 1;
  } else if (colorType === 4) {
    bytesPerPixel = 2;
  } else if (colorType === 6) {
    bytesPerPixel = 4;
  } else {
    return { width, height, orientationDegrees: 0, pixels: null, format: 'png' };
  }

  try {
    const inflated = inflateSync(Buffer.concat(idat));
    const raw = unfilterPng(inflated, width, height, bytesPerPixel);
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i += 1) {
      if (colorType === 0) {
        gray[i] = raw[i] ?? 0;
      } else if (colorType === 4) {
        gray[i] = raw[i * 2] ?? 0;
      } else if (colorType === 3) {
        const index = (raw[i] ?? 0) * 3;
        const r = palette?.[index] ?? 0;
        const g = palette?.[index + 1] ?? 0;
        const b = palette?.[index + 2] ?? 0;
        gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      } else {
        const pp = colorType === 6 ? 4 : 3;
        const r = raw[i * pp] ?? 0;
        const g = raw[i * pp + 1] ?? 0;
        const b = raw[i * pp + 2] ?? 0;
        gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
    }
    return { width, height, orientationDegrees: 0, pixels: gray, format: 'png' };
  } catch {
    return { width, height, orientationDegrees: 0, pixels: null, format: 'png' };
  }
}

function jpegOrientation(bytes: Buffer): number {
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      break;
    }
    const marker = bytes[offset + 1] ?? 0;
    const size = bytes.readUInt16BE(offset + 2);
    if (marker === 0xe1 && size > 8) {
      const payload = bytes.subarray(offset + 4, offset + 2 + size);
      if (payload.subarray(0, 6).toString('ascii') === 'Exif\0\0') {
        const tiff = payload.subarray(6);
        const le = tiff.subarray(0, 2).toString('ascii') === 'II';
        const read16 = (pos: number) => (le ? tiff.readUInt16LE(pos) : tiff.readUInt16BE(pos));
        const read32 = (pos: number) => (le ? tiff.readUInt32LE(pos) : tiff.readUInt32BE(pos));
        const ifd0 = read32(4);
        if (ifd0 + 2 < tiff.length) {
          const count = read16(ifd0);
          for (let i = 0; i < count; i += 1) {
            const entry = ifd0 + 2 + i * 12;
            if (entry + 12 > tiff.length) {
              break;
            }
            const tag = read16(entry);
            if (tag === 0x0112) {
              const value = read16(entry + 8);
              if (value === 3) {
                return 180;
              }
              if (value === 6) {
                return 90;
              }
              if (value === 8) {
                return 270;
              }
              return 0;
            }
          }
        }
      }
    }
    offset += 2 + size;
    if (marker === 0xda) {
      break;
    }
  }
  return 0;
}

function decodeJpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return { width, height };
    }
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (offset + 3 >= bytes.length) {
      break;
    }
    const size = bytes.readUInt16BE(offset + 2);
    offset += 2 + size;
  }
  return null;
}

function decodeWebpSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 30 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF') {
    return null;
  }
  if (bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    return null;
  }
  const chunk = bytes.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X' && bytes.length >= 30) {
    const width = 1 + bytes[24]! + (bytes[25]! << 8) + ((bytes[26]! & 15) << 16);
    const height = 1 + bytes[27]! + (bytes[28]! << 8) + ((bytes[29]! & 15) << 16);
    return { width, height };
  }
  if (chunk === 'VP8 ' && bytes.length >= 30) {
    const width = bytes.readUInt16LE(26) & 0x3fff;
    const height = bytes.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (chunk === 'VP8L' && bytes.length >= 25) {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export function decodeImage(bytes: Buffer): DecodedImage {
  const png = decodePng(bytes);
  if (png) {
    return png;
  }
  const jpeg = decodeJpegSize(bytes);
  if (jpeg) {
    return {
      width: jpeg.width,
      height: jpeg.height,
      orientationDegrees: jpegOrientation(bytes),
      pixels: null,
      format: 'jpeg',
    };
  }
  const webp = decodeWebpSize(bytes);
  if (webp) {
    return {
      width: webp.width,
      height: webp.height,
      orientationDegrees: 0,
      pixels: null,
      format: 'webp',
    };
  }
  return { width: 0, height: 0, orientationDegrees: 0, pixels: null, format: 'unknown' };
}

export function encodeGrayPng(width: number, height: number, pixels: Uint8Array): Buffer {
  const signature = PNG_SIG;
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 0;
  const ihdr = pngChunk('IHDR', ihdrData);
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      raw[y * (width + 1) + 1 + x] = pixels[y * width + x] ?? 0;
    }
  }
  const idat = pngChunk('IDAT', deflateSync(raw));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([header, typeBuf, data, crcBuf]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (buf[i] ?? 0)) & 255] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
