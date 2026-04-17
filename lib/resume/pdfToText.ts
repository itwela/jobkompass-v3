import { extractText } from 'unpdf';

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

/**
 * Extract plain text from a PDF (data URL or raw base64).
 * Returns empty string if the file is invalid, has no text layer, or extraction throws.
 */
export async function extractTextFromPdfBase64(resumePdf: string): Promise<string> {
  const bytes = decodePdfToUint8Array(resumePdf);
  if (!bytes) return '';
  try {
    const { text } = await extractText(bytes, { mergePages: true });
    if (typeof text !== 'string') return '';
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
}

export function isLikelyReadableResumeText(text: string): boolean {
  return text.length >= PDF_TEXT_MIN_CHARS;
}
