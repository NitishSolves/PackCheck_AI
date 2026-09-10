import {
  assertNoLegalVerdict,
  type ExtractTextInput,
  type OcrResult,
  type OcrToken,
} from '@packcheck/shared';
import type { OcrProvider } from './types.js';

export const DEMO_SPECIMEN_PROVIDER = 'demo-specimen';

function makeTokens(lines: Array<{ text: string; y: number }>): OcrToken[] {
  const tokens: OcrToken[] = [];
  for (const line of lines) {
    const words = line.text.split(/\s+/).filter(Boolean);
    let currentX = 40;
    for (const word of words) {
      const width = Math.max(word.length * 9, 20);
      tokens.push({
        text: word,
        confidence: 0.95,
        box: {
          x: currentX,
          y: line.y,
          width,
          height: 18,
        },
      });
      currentX += width + 8;
    }
  }
  return tokens;
}

const SPECIMENS = {
  cookies: {
    lines: [
      { text: 'Generic Name : Almond Cookies', y: 50 },
      { text: 'Manufactured by : NutriBites FMCG Pvt Ltd, Sector 62, Noida, UP - 201301', y: 100 },
      { text: 'Net Quantity : 400 g', y: 150 },
      { text: 'Mfg Date : 11/2025', y: 200 },
      { text: 'MRP : ₹ 220.00', y: 250 },
      { text: 'Unit Sale Price : ₹ 0.55 / g', y: 300 },
      { text: 'Consumer Care : care@nutribites.in , Ph: 1800-123-4567', y: 350 },
    ],
  },
  honey: {
    lines: [
      { text: 'Generic Name : Organic Raw Honey', y: 50 },
      { text: 'Manufactured by : PureOrigins Agro, Manali, Himachal Pradesh - 175131', y: 100 },
      { text: 'Net Quantity : 500 g', y: 150 },
      { text: 'Mfg Date : 10/2025', y: 200 },
      { text: 'MRP : ₹ 450.00 (Inclusive of all taxes)', y: 250 },
      { text: 'Unit Sale Price : ₹ 0.90 / g', y: 300 },
      { text: 'Best Before : 24 months from mfg', y: 350 },
      { text: 'Consumer Care : support@pureorigins.in , Ph: 1800-999-888', y: 400 },
    ],
  },
  gel: {
    lines: [
      { text: 'Generic Name : Fabric Wash Gel', y: 50 },
      { text: 'Manufactured by : Sparkle Detergents, GIDC, Vapi, Gujarat - 396195', y: 100 },
      { text: 'Net Quantity : 1000 ml', y: 150 },
      { text: 'Mfg Date : 09/2025', y: 200 },
      { text: 'MRP : ₹ 380.00 (Inclusive of all taxes)', y: 250 },
      { text: 'Unit Sale Price : ₹ 0.38 / ml', y: 300 },
      { text: 'Consumer Care : 1800-444-999 , care@sparklehome.in', y: 350 },
    ],
  },
  default: {
    lines: [
      { text: 'Generic Name : Packaged Consumer Goods', y: 50 },
      { text: 'Manufactured by : Standard FMCG Industries Ltd, Industrial Area, New Delhi - 110020', y: 100 },
      { text: 'Net Quantity : 250 g', y: 150 },
      { text: 'Mfg Date : 12/2025', y: 200 },
      { text: 'MRP : ₹ 150.00 (Inclusive of all taxes)', y: 250 },
      { text: 'Unit Sale Price : ₹ 0.60 / g', y: 300 },
      { text: 'Consumer Care : help@standardfmcg.com , 1800-111-222', y: 350 },
    ],
  },
};

export class DemoSpecimenOcrProvider implements OcrProvider {
  readonly name = DEMO_SPECIMEN_PROVIDER;
  readonly modelVersion = 'demo-specimen-v1';

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    const pathLower = (input.imagePath || '').toLowerCase();
    let selected = SPECIMENS.default;

    if (pathLower.includes('cookie') || pathLower.includes('nutri') || pathLower.includes('almond')) {
      selected = SPECIMENS.cookies;
    } else if (pathLower.includes('honey') || pathLower.includes('pureorigin')) {
      selected = SPECIMENS.honey;
    } else if (pathLower.includes('gel') || pathLower.includes('wash') || pathLower.includes('clean')) {
      selected = SPECIMENS.gel;
    }

    const tokens = makeTokens(selected.lines);
    const fullText = selected.lines.map((l) => l.text).join('\n');

    const result: OcrResult = {
      fullText,
      tokens,
      blocks: [
        {
          text: fullText,
          confidence: 0.95,
          box: { x: 30, y: 30, width: 600, height: 420 },
          tokens,
        },
      ],
      meanConfidence: 0.95,
      provider: this.name,
      modelVersion: this.modelVersion,
    };

    assertNoLegalVerdict(result);
    return result;
  }
}
