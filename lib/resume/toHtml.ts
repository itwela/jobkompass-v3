import {
	ResumeIR,
	SectionIR,
	ExperienceItemIR,
	EducationItemIR,
	ProjectItemIR,
	BulletIR,
	ResumeTheme,
} from '@/types/resumeIR';

function escHtml(input: string | undefined | null): string {
	if (!input) return '';
	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function dateRange(start?: string, end?: string | 'Present'): string {
	const s = start ? escHtml(start) : '';
	const e = end ? escHtml(end) : '';
	if (!s && !e) return '';
	if (s && !e) return s;
	if (!s && e) return e;
	return `${s} – ${e}`;
}

function renderHeader(ir: ResumeIR): string {
	const fullName = `${escHtml(ir.personal.firstName)} ${escHtml(ir.personal.lastName)}`.trim() || '&nbsp;';
	const links =
		ir.personal.links?.map(l => `${escHtml(l.label)}: ${escHtml(l.url)}`).filter(Boolean) ?? [];
	const metaParts = [
		escHtml(ir.personal.email),
		ir.personal.phone ? escHtml(ir.personal.phone) : '',
		ir.personal.location ? escHtml(ir.personal.location) : '',
		...links,
	].filter(Boolean);
	const metaLine =
		metaParts.length > 0 ? metaParts.map(part => `<span>${part}</span>`).join('') : '<span>&nbsp;</span>';

	return `<header class="resume-header">
		<div class="resume-name">${fullName}</div>
		<div class="resume-meta">${metaLine}</div>
	</header>`;
}

function renderBullets(bullets: BulletIR[]): string {
	if (!bullets || bullets.length === 0) return '';
	const items = bullets
		.map(b => `<li class="resume-bullet" data-id="${escHtml(b.id)}">${escHtml(b.text)}</li>`)
		.join('\n');
	return `<ul class="resume-bullets">
${items}
</ul>`;
}

function renderExperienceItems(items: ExperienceItemIR[]): string {
	if (!items || items.length === 0) return '';
	return items
		.map(it => {
			const right = [dateRange(it.start, it.end), it.location ? escHtml(it.location) : '']
				.filter(Boolean)
				.join('  ·  ');
			return `<div class="resume-entry" data-id="${escHtml(it.id)}">
	<div class="resume-entry-header">
		<span class="resume-entry-heading">${escHtml(it.company)}</span>
		<span class="resume-entry-meta">${right || '&nbsp;'}</span>
	</div>
	<div class="resume-entry-subheading">${escHtml(it.title) || '&nbsp;'}</div>
	${renderBullets(it.bullets)}
</div>`;
		})
		.join('\n');
}

function renderEducationItems(items: EducationItemIR[]): string {
	if (!items || items.length === 0) return '';
	return items
		.map(it => {
			const right = [dateRange(it.start, it.end), it.location ? escHtml(it.location) : '']
				.filter(Boolean)
				.join('  ·  ');
			const degreeLine = [escHtml(it.degree), it.gpa ? `GPA: ${escHtml(it.gpa)}` : '']
				.filter(Boolean)
				.join('  ·  ');
			return `<div class="resume-entry" data-id="${escHtml(it.id)}">
	<div class="resume-entry-header">
		<span class="resume-entry-heading">${escHtml(it.school)}</span>
		<span class="resume-entry-meta">${right || '&nbsp;'}</span>
	</div>
	<div class="resume-entry-subheading">${degreeLine || '&nbsp;'}</div>
	${it.bullets && it.bullets.length ? renderBullets(it.bullets) : ''}
</div>`;
		})
		.join('\n');
}

function renderProjectsItems(items: ProjectItemIR[]): string {
	if (!items || items.length === 0) return '';
	return items
		.map(it => {
			const right = [
				dateRange(it.start, it.end),
				it.link ? `<a href="${escHtml(it.link)}">Link</a>` : '',
			]
				.filter(Boolean)
				.join('  ·  ');
			const role = it.role ? ` <span class="resume-entry-role">(${escHtml(it.role)})</span>` : '';
			const tech = it.tech && it.tech.length ? `Tech: ${escHtml(it.tech.join(', '))}` : '';
			return `<div class="resume-entry" data-id="${escHtml(it.id)}">
	<div class="resume-entry-header">
		<span class="resume-entry-heading">${escHtml(it.name)}${role}</span>
		<span class="resume-entry-meta">${right || '&nbsp;'}</span>
	</div>
	${tech ? `<div class="resume-entry-subheading">${tech}</div>` : ''}
	${renderBullets(it.bullets)}
</div>`;
		})
		.join('\n');
}

function renderSkillsContent(tech: string[], other?: string[]): string {
	const parts: string[] = [];
	if (tech && tech.length > 0) {
		parts.push(
			`<div class="resume-flex-row"><span class="resume-flex-label">Technical</span><span class="resume-flex-value">${escHtml(
				tech.join(', ')
			)}</span></div>`,
		);
	}
	if (other && other.length > 0) {
		parts.push(
			`<div class="resume-flex-row"><span class="resume-flex-label">Other</span><span class="resume-flex-value">${escHtml(
				other.join(', ')
			)}</span></div>`,
		);
	}
	return parts.join('\n');
}

function renderAdditionalContent(items: { label: string; values: string[] }[]): string {
	if (!items || items.length === 0) return '';
	return items
		.map(
			i =>
				`<div class="resume-flex-row"><span class="resume-flex-label">${escHtml(
					i.label,
				)}</span><span class="resume-flex-value">${escHtml(i.values.join(', '))}</span></div>`,
		)
		.join('\n');
}

function renderSection(title: string, innerHtml: string, className: string): string {
	const trimmedInner = innerHtml.trim();
	return `<section class="resume-section ${className}${trimmedInner ? '' : ' is-empty'}">
	<h2 class="resume-section-title">${title}</h2>
	<div class="resume-section-body">
		${trimmedInner || '<div class="resume-empty-row">&nbsp;</div>'}
	</div>
</section>`;
}

function findSection<TKind extends SectionIR['kind']>(
	sections: SectionIR[],
	kind: TKind,
): Extract<SectionIR, { kind: TKind }> | undefined {
	return sections.find((section): section is Extract<SectionIR, { kind: TKind }> => section.kind === kind);
}

export function toHtml(ir: ResumeIR, theme: ResumeTheme = 'jake'): string {
	const education = findSection(ir.sections, 'education');
	const experience = findSection(ir.sections, 'experience');
	const projects = findSection(ir.sections, 'projects');
	const skills = findSection(ir.sections, 'skills');
	const additional = findSection(ir.sections, 'additional');

	const html = `
<article class="resume ${theme}">
	${renderHeader(ir)}
	${renderSection('Education', renderEducationItems(education?.items ?? []), 'education')}
	${renderSection('Experience', renderExperienceItems(experience?.items ?? []), 'experience')}
	${renderSection('Projects', renderProjectsItems(projects?.items ?? []), 'projects')}
	${renderSection('Skills', skills ? renderSkillsContent(skills.tech, skills.other) : '', 'skills')}
	${renderSection('Additional Information', renderAdditionalContent(additional?.items ?? []), 'additional')}
</article>`;
	return html.trim();
}
