import { describe, it, expect } from 'vitest';
import { toDownloadFileName } from './downloadFileName';

describe('toDownloadFileName', () => {
  it('appends .pdf to a document name', () => {
    expect(toDownloadFileName('Mar Resume')).toBe('Mar Resume.pdf');
  });

  it('does not double up an existing .pdf extension', () => {
    expect(toDownloadFileName('Mar Resume.pdf')).toBe('Mar Resume.pdf');
    expect(toDownloadFileName('Mar Resume.PDF')).toBe('Mar Resume.PDF');
  });

  it('turns colons into periods so timestamps stay readable', () => {
    expect(toDownloadFileName('Mar Resume: v2')).toBe('Mar Resume. v2.pdf');
    expect(
      toDownloadFileName('Itwela Ibomu Resume - 2026 (Aug 3, 2026 11:35 PM)')
    ).toBe('Itwela Ibomu Resume - 2026 (Aug 3, 2026 11.35 PM).pdf');
  });

  it('strips the other characters that are illegal in filenames', () => {
    expect(toDownloadFileName('a/b\\c*d?e"f<g>h|i')).toBe('abcdefghi.pdf');
  });

  it('collapses whitespace and trims', () => {
    expect(toDownloadFileName('  Mar   Resume  ')).toBe('Mar Resume.pdf');
  });

  it('falls back to resume.pdf when there is no usable name', () => {
    expect(toDownloadFileName(undefined)).toBe('resume.pdf');
    expect(toDownloadFileName('')).toBe('resume.pdf');
    expect(toDownloadFileName('   ')).toBe('resume.pdf');
    expect(toDownloadFileName('///')).toBe('resume.pdf');
  });
});
