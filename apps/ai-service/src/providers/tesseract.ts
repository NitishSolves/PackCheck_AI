import { spawn } from 'node:child_process';
import {
  AiProviderError,
  clampConfidence,
  meanConfidence,
  ocrResultSchema,
  type ExtractTextInput,
  type OcrResult,
} from '@packcheck/shared';
import { withTimeout } from './timeout.js';
import type { OcrProvider } from './types.js';

type TesseractWord = {
  text?: string;
  conf?: number;
  bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
};

type TesseractBlock = {
  text?: string;
  conf?: number;
  bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
  paragraphs?: Array<{
    lines?: Array<{
      words?: TesseractWord[];
    }>;
  }>;
};

type TesseractPayload = {
  data?: {
    text?: string;
    confidence?: number;
    words?: TesseractWord[];
    blocks?: TesseractBlock[];
  };
};

function boxFrom(bbox: TesseractWord['bbox'], imageId?: string) {
  const x0 = Math.max(0, bbox?.x0 ?? 0);
  const y0 = Math.max(0, bbox?.y0 ?? 0);
  const x1 = Math.max(x0 + 1, bbox?.x1 ?? x0 + 1);
  const y1 = Math.max(y0 + 1, bbox?.y1 ?? y0 + 1);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, imageId };
}

function conf01(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1 && value <= 100) {
    return clampConfidence(value / 100);
  }
  return clampConfidence(value);
}

async function runTesseractJson(imagePath: string, lang: string, timeoutMs: number): Promise<TesseractPayload> {
  const child = spawn('tesseract', [imagePath, 'stdout', '-l', lang, '--psm', '6', 'tsv'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

  const waitExit = new Promise<number>((resolve, reject) => {
    child.on('error', (error) => {
      reject(
        new AiProviderError(
          'PROVIDER_ERROR',
          `tesseract is not available: ${error.message}. Configure a real OCR provider or use test-fixture in CI.`,
        ),
      );
    });
    child.on('close', (code) => resolve(code ?? 1));
  });

  const code = await withTimeout(waitExit, timeoutMs, 'tesseract');
  if (code !== 0) {
    const err = Buffer.concat(stderr).toString('utf8').trim();
    throw new AiProviderError(
      'PROVIDER_ERROR',
      `tesseract failed (${code})${err ? `: ${err}` : ''}`,
    );
  }

  const tsv = Buffer.concat(stdout).toString('utf8');
  return tsvToPayload(tsv);
}

function tsvToPayload(tsv: string): TesseractPayload {
  const lines = tsv.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length <= 1) {
    return { data: { text: '', confidence: 0, words: [], blocks: [] } };
  }
  const words: TesseractWord[] = [];
  const blockMap = new Map<string, TesseractBlock>();
  for (const line of lines.slice(1)) {
    const cols = line.split('\t');
    const level = cols[0];
    const page = cols[1] ?? '1';
    const block = cols[2] ?? '1';
    const text = (cols[11] ?? '').trim();
    const conf = Number.parseFloat(cols[10] ?? '-1');
    const x0 = Number.parseInt(cols[6] ?? '0', 10);
    const y0 = Number.parseInt(cols[7] ?? '0', 10);
    const w = Number.parseInt(cols[8] ?? '1', 10);
    const h = Number.parseInt(cols[9] ?? '1', 10);
    const bbox = { x0, y0, x1: x0 + w, y1: y0 + h };
    if (level === '4') {
      const key = `${page}-${block}`;
      const existing = blockMap.get(key) ?? { text: '', conf, bbox, paragraphs: [{ lines: [{ words: [] }] }] };
      existing.bbox = bbox;
      existing.conf = conf;
      blockMap.set(key, existing);
    }
    if (level === '5' && text) {
      const word: TesseractWord = { text, conf, bbox };
      words.push(word);
      const key = `${page}-${block}`;
      const existing = blockMap.get(key);
      if (existing?.paragraphs?.[0]?.lines?.[0]) {
        existing.paragraphs[0].lines[0].words?.push(word);
        existing.text = `${existing.text ?? ''} ${text}`.trim();
      }
    }
  }
  return {
    data: {
      text: words.map((word) => word.text).join(' '),
      confidence: words.length
        ? words.reduce((sum, word) => sum + (word.conf ?? 0), 0) / words.length
        : 0,
      words,
      blocks: [...blockMap.values()],
    },
  };
}

export class TesseractOcrProvider implements OcrProvider {
  readonly name = 'tesseract';
  readonly modelVersion = 'tesseract-cli';

  constructor(
    private readonly lang: string,
    private readonly timeoutMs: number,
  ) {}

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    const payload = await runTesseractJson(input.imagePath, this.lang, this.timeoutMs);
    const data = payload.data;
    if (!data) {
      throw new AiProviderError('MALFORMED_RESPONSE', 'tesseract returned no data payload');
    }
    const tokens = (data.words ?? [])
      .filter((word) => (word.text ?? '').trim().length > 0)
      .map((word) => ({
        text: (word.text ?? '').trim(),
        confidence: conf01(word.conf),
        box: boxFrom(word.bbox, input.imageId),
      }));
    const blocks = (data.blocks ?? []).map((block) => {
      const blockTokens =
        block.paragraphs?.flatMap((paragraph) =>
          paragraph.lines?.flatMap((line) => line.words ?? []) ?? [],
        ) ?? [];
      return {
        text: (block.text ?? '').trim(),
        confidence: conf01(block.conf),
        box: boxFrom(block.bbox, input.imageId),
        tokens: blockTokens
          .filter((word) => (word.text ?? '').trim().length > 0)
          .map((word) => ({
            text: (word.text ?? '').trim(),
            confidence: conf01(word.conf),
            box: boxFrom(word.bbox, input.imageId),
          })),
      };
    });
    const mean = tokens.length > 0 ? meanConfidence(tokens.map((token) => token.confidence)) : conf01(data.confidence);
    const parsed = ocrResultSchema.safeParse({
      fullText: (data.text ?? tokens.map((token) => token.text).join(' ')).trim(),
      tokens,
      blocks,
      meanConfidence: mean,
      provider: this.name,
      modelVersion: this.modelVersion,
    });
    if (!parsed.success) {
      throw new AiProviderError('MALFORMED_RESPONSE', 'tesseract output failed OCR schema validation');
    }
    return parsed.data;
  }
}
