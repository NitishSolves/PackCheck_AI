import { readFile } from 'node:fs/promises';
import { AiProviderError } from '@packcheck/shared';
import { decodeImage, type DecodedImage } from './image-decode.js';

export async function readDecodedImage(imagePath: string): Promise<{ bytes: Buffer; image: DecodedImage }> {
  let bytes: Buffer;
  try {
    bytes = await readFile(imagePath);
  } catch (error) {
    throw new AiProviderError(
      'IMAGE_UNREADABLE',
      `Unable to read image at ${imagePath}: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  if (bytes.length === 0) {
    throw new AiProviderError('IMAGE_UNREADABLE', `Image at ${imagePath} is empty`);
  }
  return { bytes, image: decodeImage(bytes) };
}
