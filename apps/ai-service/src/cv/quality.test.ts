import { describe, expect, it } from 'vitest';
import { decodeImage, encodeGrayPng } from './image-decode.js';
import { scoreDecodedImage } from './quality.js';

function grayImage(width: number, height: number, fill: (x: number, y: number) => number): Buffer {
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = fill(x, y);
    }
  }
  return encodeGrayPng(width, height, pixels);
}

describe('image quality scoring', () => {
  it('scores a sharp high-resolution checkerboard as accepted', () => {
    const bytes = grayImage(640, 480, (x, y) => ((x + y) % 2 === 0 ? 20 : 220));
    const decoded = decodeImage(bytes);
    expect(decoded.width).toBe(640);
    expect(decoded.pixels).not.toBeNull();
    const result = scoreDecodedImage(decoded, { provider: 'local-cv', modelVersion: 'test' });
    expect(result.status).toBe('accepted');
    expect(result.metrics?.resolution.width).toBe(640);
    expect(result.structuredIssues.some((issue) => issue.code === 'low_resolution')).toBe(false);
  });

  it('flags tiny images as low resolution / retake', () => {
    const bytes = grayImage(80, 60, () => 128);
    const result = scoreDecodedImage(decodeImage(bytes), { provider: 'local-cv', modelVersion: 'test' });
    expect(result.status).toBe('retake_required');
    expect(result.structuredIssues.some((issue) => issue.code === 'low_resolution')).toBe(true);
  });

  it('flags heavy glare and occlusion when pixel data is present', () => {
    const glare = grayImage(420, 420, () => 255);
    const glareResult = scoreDecodedImage(decodeImage(glare), { provider: 'local-cv', modelVersion: 'test' });
    expect(glareResult.structuredIssues.some((issue) => issue.code === 'glare')).toBe(true);

    const occluded = grayImage(420, 420, () => 0);
    const occludedResult = scoreDecodedImage(decodeImage(occluded), { provider: 'local-cv', modelVersion: 'test' });
    expect(occludedResult.structuredIssues.some((issue) => issue.code === 'occlusion')).toBe(true);
  });

  it('does not invent quality for undecodable bytes', () => {
    const result = scoreDecodedImage(decodeImage(Buffer.from('not-an-image')), {
      provider: 'local-cv',
      modelVersion: 'test',
    });
    expect(result.status).toBe('retake_required');
    expect(result.structuredIssues.some((issue) => issue.code === 'unreadable')).toBe(true);
    expect(result.score).toBeLessThan(0.5);
  });
});
