import fs from 'fs';
import path from 'path';
import { ResumeIR, SectionIR, ExperienceItemIR, EducationItemIR, ProjectItemIR, BulletIR } from '@/types/resumeIR';

function esc(input: string | undefined | null): string {
	if (!input) return '';
	return input.replace(/([\\{}&$%#_^])/g, '\\$1');
}

function dateRange(start?: string, end?: string | 'Present'): string {
	const s = start ? esc(start) : '';
	const e = end ? esc(end) : '';
	if (!s && !e) return '';
	if (s && !e) return s;
	if (!s && e) return e;
	return `${s} -- ${e}`;
}

function renderHeader(ir: ResumeIR): string {
	const fullName = `${esc(ir.personal.firstName)} ${esc(ir.personal.lastName)}`.trim();
	const parts: string[] = [];
	parts.push(`\\centerline{\\Huge \\textbf{${fullName}}}`);
	const lines: string[] = [];
	lines.push(esc(ir.personal.email));
	if (ir.personal.location) lines.push(esc(ir.personal.location));
	if (ir.personal.links && ir.personal.links.length > 0) {
		for (const l of ir.personal.links) {
			lines.push(`\\href{${esc(l.url)}}{${esc(l.url)}}`);
		}
	}
	parts.push(`\\centerline{${lines.join(' \\quad \\textbar\\ \\quad ')}}`);
	return parts.join('\n') + '\n';
}

function renderBullets(bullets: BulletIR[]): string {
	if (!bullets || bullets.length === 0) return '';
	const bulletLines = bullets.map(b => `\\resumeItem{${esc(b.text)}}`);
	return ['\\resumeItemListStart', ...bulletLines, '\\resumeItemListEnd'].join('\n');
}

function renderExperience(items: ExperienceItemIR[]): string {
	if (!items || items.length === 0) return '% No experience';
	const lines: string[] = ['\\resumeSubHeadingListStart'];
	for (const it of items) {
		const right = [dateRange(it.start, it.end), it.location ? esc(it.location) : ''].filter(Boolean).join('  \\quad ');
		lines.push(`\\resumeSubheading{${esc(it.company)}}{${right}}{${esc(it.title)}}{}`);
		lines.push(renderBullets(it.bullets));
	}
	lines.push('\\resumeSubHeadingListEnd');
	return lines.join('\n');
}

function renderEducation(items: EducationItemIR[]): string {
	if (!items || items.length === 0) return '% No education';
	const lines: string[] = ['\\resumeSubHeadingListStart'];
	for (const it of items) {
		const right = [dateRange(it.start, it.end), it.location ? esc(it.location) : ''].filter(Boolean).join('  \\quad ');
		lines.push(`\\resumeSubheading{${esc(it.school)}}{${right}}{${esc(it.degree)}}{${it.gpa ? `GPA: ${esc(it.gpa)}` : ''}}`);
		if (it.bullets && it.bullets.length > 0) {
			lines.push(renderBullets(it.bullets));
		}
	}
	lines.push('\\resumeSubHeadingListEnd');
	return lines.join('\n');
}

function renderProjects(items: ProjectItemIR[]): string {
	if (!items || items.length === 0) return '% No projects';
	const lines: string[] = [];
	for (const it of items) {
		const right = [dateRange(it.start, it.end), it.link ? `\\href{${esc(it.link)}}{Link}` : ''].filter(Boolean).join('  \\quad ');
		lines.push(`\\resumeProjectHeading{\\textbf{${esc(it.name)}}${it.role ? ` \\textit{(${esc(it.role)})}` : ''}}{${right}}`);
		if (it.tech && it.tech.length > 0) {
			lines.push(`\\resumeProjectDetails{\\textbf{Tech:} ${esc(it.tech.join(', '))}}`);
		}
		if (it.bullets && it.bullets.length > 0) {
			lines.push(renderBullets(it.bullets));
		}
	}
	return lines.join('\n');
}

function renderSkills(tech: string[], other?: string[]): string {
	const parts: string[] = [];
	if (tech && tech.length > 0) {
		parts.push(`\\resumeFlexContent{Technical}{${esc(tech.join(', '))}}`);
	}
	if (other && other.length > 0) {
		parts.push(`\\resumeFlexContent{Other}{${esc(other.join(', '))}}`);
	}
	return parts.join('\n');
}

function renderAdditional(items: { label: string; values: string[] }[]): string {
	if (!items || items.length === 0) return '% No additional';
	return items
		.map(i => `\\resumeFlexContent{${esc(i.label)}}{${esc(i.values.join(', '))}}`)
		.join('\n');
}

export function toLatex(ir: ResumeIR, templateString?: string): string {
	const templatePath = path.join(process.cwd(), 'templates', 'resume', 'jakeLatex.tex');
	const template = typeof templateString === 'string' ? templateString : fs.readFileSync(templatePath, 'utf-8');

	let doc = template;

	// Header
	doc = doc.replace('% HEADER_PLACEHOLDER', renderHeader(ir));

	// Sections
	let educationLatex = '% EDUCATION_PLACEHOLDER';
	let experienceLatex = '% EXPERIENCE_PLACEHOLDER';
	let projectsLatex = '% PROJECTS_PLACEHOLDER';
	let skillsLatex = '% SKILLS_PLACEHOLDER';
	let additionalLatex = '% ADDITIONAL_INFO_PLACEHOLDER';

	for (const section of ir.sections) {
		switch (section.kind) {
			case 'education':
				educationLatex = renderEducation(section.items);
				break;
			case 'experience':
				experienceLatex = renderExperience(section.items);
				break;
			case 'projects':
				projectsLatex = renderProjects(section.items);
				break;
			case 'skills':
				skillsLatex = renderSkills(section.tech, section.other);
				break;
			case 'additional':
				additionalLatex = renderAdditional(section.items);
				break;
		}
	}

	doc = doc.replace('% EDUCATION_PLACEHOLDER', educationLatex);
	doc = doc.replace('% EXPERIENCE_PLACEHOLDER', experienceLatex);
	doc = doc.replace('% PROJECTS_PLACEHOLDER', projectsLatex);
	doc = doc.replace('% SKILLS_PLACEHOLDER', skillsLatex);
	doc = doc.replace('% ADDITIONAL_INFO_PLACEHOLDER', additionalLatex);

	return doc;
}


