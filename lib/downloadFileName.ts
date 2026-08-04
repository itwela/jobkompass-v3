/**
 * Turn a document name into a safe download filename ending in `.pdf`.
 *
 * Colons become periods rather than being dropped, because resume names carry
 * timestamps and dropping the colon turns "11:35 PM" into an unreadable
 * "1135 PM". The remaining characters that are illegal in Windows/macOS
 * filenames are dropped, so "Mar Resume <v2>" saves as "Mar Resume v2.pdf".
 */
export function toDownloadFileName(name?: string): string {
  const cleaned = (name || '')
    .replace(/:/g, '.')
    .replace(/[\\/*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'resume.pdf';
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`;
}
