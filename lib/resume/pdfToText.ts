import { extractText, getDocumentProxy } from 'unpdf';

// unpdf's bundled pdf.js calls Promise.try, which Node 22 does not have; without
// this every text extraction throws and falls back to the weaker paths.
const P = Promise as unknown as { try?: <T>(fn: (...a: unknown[]) => T | PromiseLike<T>, ...a: unknown[]) => Promise<T> };
if (typeof P.try !== 'function') {
  P.try = (fn, ...a) => new Promise((resolve) => resolve(fn(...a)));
}

/** Treat extracted text as usable for LLM if at least this many characters (avoids noise / empty layers). */
export const PDF_TEXT_MIN_CHARS = 20;

function decodePdfToUint8Array(resumePdf: string): Uint8Array | null {
  const base64 = resumePdf.replace(/^data:application\/pdf;base64,/i, '').replace(/\s/g, '');
  try {
    const buf = Buffer.from(base64, 'base64');
    if (buf.length < 24) return null;
    const header = buf.subarray(0, 5).toString('latin1');
    if (!header.startsWith('%PDF')) return null;
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

const PDF_PARSE_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

/**
 * Extract plain text from a PDF (data URL or raw base64).
 * Returns empty string if the file is invalid, has no text layer, or extraction throws.
 * Times out so pathological PDFs cannot hang the upload pipeline indefinitely.
 */
export async function extractTextFromPdfBase64(resumePdf: string): Promise<string> {
  const bytes = decodePdfToUint8Array(resumePdf);
  if (!bytes) return '';
  try {
    // Keep the PDF's own line breaks: section headings and job headers must stay
    // on their own lines, or the fact guard can't find the employers in them.
    const text = await withTimeout(linedText(bytes), PDF_PARSE_TIMEOUT_MS).catch(async () => {
      const merged = await withTimeout(extractText(new Uint8Array(bytes), { mergePages: true }), PDF_PARSE_TIMEOUT_MS);
      return typeof merged.text === 'string' ? merged.text : '';
    });
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
}

/** Page text with a newline wherever pdf.js marks the end of a line. */
async function linedText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    let out = '';
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (typeof item.str !== 'string') continue;
      out += item.str;
      if (item.hasEOL) out += '\n';
    }
    pages.push(out);
  }
  return pages.join('\n');
}

export function isLikelyReadableResumeText(text: string): boolean {
  return text.length >= PDF_TEXT_MIN_CHARS;
}
