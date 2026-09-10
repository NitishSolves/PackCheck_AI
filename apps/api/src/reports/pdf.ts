function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

export function buildTextPdf(title: string, lines: string[]): Buffer {
  const pageWidth = 612;
  const pageHeight = 792;
  const left = 54;
  const top = 732;
  const lineHeight = 14;
  const maxChars = 92;
  const wrapped: string[] = [];
  wrapped.push(title);
  wrapped.push('');
  for (const line of lines) {
    if (line.length === 0) {
      wrapped.push('');
      continue;
    }
    wrapped.push(...wrapLine(line, maxChars));
  }

  const linesPerPage = Math.floor((top - 54) / lineHeight);
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) {
    pages.push(['']);
  }

  const objects: string[] = [];
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n');
  const pageIds = pages.map((_, index) => 3 + index * 2);
  const kids = pageIds.map((id) => `${id} 0 R`).join(' ');
  objects.push(`2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pages.length} >> endobj\n`);

  const fontId = 3 + pages.length * 2;
  pages.forEach((pageLines, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const contentOps = [
      'BT',
      '/F1 11 Tf',
      `${lineHeight} TL`,
      `${left} ${top} Td`,
      ...pageLines.map((line) => `(${escapePdfText(line)}) Tj T*`),
      'ET',
    ].join('\n');
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >> endobj\n`,
    );
    objects.push(
      `${contentId} 0 obj << /Length ${Buffer.byteLength(contentOps, 'utf8')} >> stream\n${contentOps}\nendstream\nendobj\n`,
    );
  });
  objects.push(`${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`);

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += object;
  }
  const xrefStart = Buffer.byteLength(body, 'utf8');
  const xrefEntries = ['0000000000 65535 f \n'];
  for (let i = 1; i < offsets.length; i += 1) {
    xrefEntries.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  body += `xref\n0 ${offsets.length}\n${xrefEntries.join('')}`;
  body += `trailer << /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, 'utf8');
}
