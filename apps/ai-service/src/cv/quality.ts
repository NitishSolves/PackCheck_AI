import type {
  ImageQualityIssue,
  ImageQualityMetrics,
  ImageQualityResult,
} from '@packcheck/shared';
import { clampConfidence } from '@packcheck/shared';
import type { DecodedImage } from './image-decode.js';

const MIN_ACCEPT_SCORE = 0.5;
const MIN_DIMENSION = 400;
const BLUR_SHARP_VARIANCE = 180;
const GLARE_RATIO = 0.12;
const OCCLUSION_RATIO = 0.35;

function laplacianVariance(image: DecodedImage): number | null {
  if (!image.pixels || image.width < 3 || image.height < 3) {
    return null;
  }
  const { width, height, pixels } = image;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const c = pixels[y * width + x] ?? 0;
      const left = pixels[y * width + (x - 1)] ?? 0;
      const right = pixels[y * width + (x + 1)] ?? 0;
      const up = pixels[(y - 1) * width + x] ?? 0;
      const down = pixels[(y + 1) * width + x] ?? 0;
      const lap = 4 * c - left - right - up - down;
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }
  if (count === 0) {
    return null;
  }
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
}

function ratioWhere(image: DecodedImage, predicate: (value: number) => boolean): number | null {
  if (!image.pixels || image.pixels.length === 0) {
    return null;
  }
  let hits = 0;
  for (const value of image.pixels) {
    if (predicate(value)) {
      hits += 1;
    }
  }
  return hits / image.pixels.length;
}

function blurScore(variance: number | null): number {
  if (variance === null) {
    return 0.5;
  }
  return clampConfidence(variance / BLUR_SHARP_VARIANCE);
}

function glareScore(ratio: number | null): number {
  if (ratio === null) {
    return 0.5;
  }
  if (ratio <= 0.02) {
    return 1;
  }
  if (ratio >= GLARE_RATIO) {
    return clampConfidence(1 - (ratio - 0.02) / 0.3);
  }
  return clampConfidence(1 - ratio * 4);
}

function occlusionScore(ratio: number | null): number {
  if (ratio === null) {
    return 0.5;
  }
  return clampConfidence(1 - ratio / OCCLUSION_RATIO);
}

function resolutionScore(width: number, height: number): number {
  if (width <= 0 || height <= 0) {
    return 0;
  }
  const mp = (width * height) / 1_000_000;
  const minDim = Math.min(width, height);
  if (minDim < 200) {
    return 0.1;
  }
  if (minDim < MIN_DIMENSION) {
    return 0.35;
  }
  if (mp >= 2) {
    return 1;
  }
  if (mp >= 1) {
    return 0.9;
  }
  if (mp >= 0.3) {
    return 0.7;
  }
  return 0.45;
}

function orientationScore(degrees: number): { score: number; upright: boolean } {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized === 0) {
    return { score: 1, upright: true };
  }
  if (normalized === 180) {
    return { score: 0.45, upright: false };
  }
  return { score: 0.3, upright: false };
}

export function scoreDecodedImage(
  image: DecodedImage,
  input: { provider: string; modelVersion: string | null },
): ImageQualityResult {
  const width = image.width;
  const height = image.height;
  const megapixels = width > 0 && height > 0 ? (width * height) / 1_000_000 : 0;
  const resScore = resolutionScore(width, height);
  const variance = laplacianVariance(image);
  const saturated = ratioWhere(image, (value) => value >= 250);
  const covered = ratioWhere(image, (value) => value <= 12);
  const bScore = blurScore(variance);
  const gScore = glareScore(saturated);
  const oScore = occlusionScore(covered);
  const orientation = orientationScore(image.orientationDegrees);

  const metrics: ImageQualityMetrics = {
    resolution: { width, height, megapixels, score: resScore },
    blur: { laplacianVariance: variance ?? 0, score: bScore },
    glare: { saturatedRatio: saturated ?? 0, score: gScore },
    occlusion: { estimatedCoveredRatio: covered ?? 0, score: oScore },
    orientation: {
      degrees: image.orientationDegrees,
      uprightLikely: orientation.upright,
      score: orientation.score,
    },
  };

  const structuredIssues: ImageQualityIssue[] = [];
  if (resScore < 0.5) {
    structuredIssues.push({
      code: 'low_resolution',
      score: resScore,
      detail: `${width}x${height}`,
    });
  }
  if (variance !== null && bScore < 0.45) {
    structuredIssues.push({
      code: 'blur',
      score: bScore,
      detail: `laplacianVariance=${variance.toFixed(1)}`,
    });
  }
  if (saturated !== null && gScore < 0.5) {
    structuredIssues.push({
      code: 'glare',
      score: gScore,
      detail: `saturatedRatio=${saturated.toFixed(3)}`,
    });
  }
  if (covered !== null && oScore < 0.5) {
    structuredIssues.push({
      code: 'occlusion',
      score: oScore,
      detail: `coveredRatio=${covered.toFixed(3)}`,
    });
  }
  if (!orientation.upright) {
    structuredIssues.push({
      code: 'orientation',
      score: orientation.score,
      detail: `degrees=${image.orientationDegrees}`,
    });
  }
  if (image.format === 'unknown' || width === 0) {
    structuredIssues.push({
      code: 'unreadable',
      score: 0,
      detail: 'Unable to decode image headers',
    });
  }

  const unreadable = image.format === 'unknown' || width === 0;
  const measured = [resScore, orientation.score];
  if (variance !== null) {
    measured.push(bScore);
  }
  if (saturated !== null) {
    measured.push(gScore);
  }
  if (covered !== null) {
    measured.push(oScore);
  }
  const score = unreadable
    ? 0
    : clampConfidence(measured.reduce((a, b) => a + b, 0) / measured.length);
  const retake =
    unreadable ||
    score < MIN_ACCEPT_SCORE ||
    structuredIssues.some((issue) => issue.code === 'unreadable' || issue.code === 'low_resolution');

  return {
    status: retake ? 'retake_required' : 'accepted',
    score,
    issues: structuredIssues.map((issue) => `${issue.code}: ${issue.detail}`),
    structuredIssues,
    metrics,
    provider: input.provider,
    modelVersion: input.modelVersion,
  };
}
