import { describe, it, expect } from 'vitest';
import { generateMarLatex } from './generateMarLatex';

const base: any = {
  personalInfo: { firstName: 'Itwela', lastName: 'Ibomu', summary: 'S' },
  skills: { technical: [], additional: [] },
};

describe('mar technical skills', () => {
  it('groups bare items under the preceding category', () => {
    const tex = generateMarLatex({
      ...base,
      skills: {
        technical: [
          'Languages: Python', 'TypeScript', 'JavaScript',
          'Frontend: React', 'Next.js', 'Tailwind CSS',
        ],
        additional: ['Systems Design'],
      },
    });
    expect(tex).toContain('\\marskillline{Languages:}{Python, TypeScript, JavaScript}');
    expect(tex).toContain('\\marskillline{Frontend:}{React, Next.js, Tailwind CSS}');
    expect(tex).toContain('\\marskillline{Additional Skills:}{Systems Design}');
  });

  it('leaves an already-complete label line alone', () => {
    const tex = generateMarLatex({
      ...base,
      skills: { technical: ['Databases: PostgreSQL, Pinecone'], additional: [] },
    });
    expect(tex).toContain('\\marskillline{Databases:}{PostgreSQL, Pinecone}');
  });

  it('does not treat a URL colon as a category label', () => {
    const tex = generateMarLatex({
      ...base,
      skills: { technical: ['Tools: Docker', 'https://example.com'], additional: [] },
    });
    expect(tex).toContain('\\marskillline{Tools:}{Docker, https://example.com}');
  });

  it('keeps bare items that appear before any category', () => {
    const tex = generateMarLatex({
      ...base,
      skills: { technical: ['Python', 'Go', 'Cloud: AWS'], additional: [] },
    });
    expect(tex).toContain('Python, Go');
    expect(tex).toContain('\\marskillline{Cloud:}{AWS}');
  });
});
