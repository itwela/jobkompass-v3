export type ResumeIR = {
	personal: {
		firstName: string;
		lastName: string;
		email: string;
		location?: string;
		links?: { label: 'LinkedIn' | 'GitHub' | 'Portfolio'; url: string }[];
	};
	sections: Array<SectionIR>;
	meta: { template: 'jake' | 'modern' | 'compact'; lastEditedISO: string };
};

export type SectionIR =
	| { kind: 'education'; items: EducationItemIR[] }
	| { kind: 'experience'; items: ExperienceItemIR[] }
	| { kind: 'projects'; items: ProjectItemIR[] }
	| { kind: 'skills'; tech: string[]; other?: string[] }
	| { kind: 'additional'; items: { label: string; values: string[] }[] };

export type ExperienceItemIR = {
	id: string;
	company: string;
	title: string;
	location?: string;
	start: string;
	end: string | 'Present';
	bullets: BulletIR[];
};

export type BulletIR = { id: string; text: string; impact?: number; tags?: string[] };

export type EducationItemIR = {
	id: string;
	school: string;
	degree: string;
	location?: string;
	start?: string;
	end?: string | 'Present';
	gpa?: string;
	bullets?: BulletIR[];
};

export type ProjectItemIR = {
	id: string;
	name: string;
	role?: string;
	link?: string;
	start?: string;
	end?: string | 'Present';
	bullets: BulletIR[];
	tech?: string[];
};

export type ResumePatchOp =
	| { op: 'update-bullet'; sectionId: string; itemId: string; bulletId: string; text: string }
	| { op: 'add-skill'; value: string }
	| { op: 'reorder-section'; from: number; to: number };

export type ResumeTheme = 'jake' | 'modern';


