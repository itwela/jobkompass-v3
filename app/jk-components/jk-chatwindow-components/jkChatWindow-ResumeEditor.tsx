'use client'

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ResumeIR, SectionIR, ExperienceItemIR, BulletIR } from "@/types/resumeIR";
import ResumeAssistantPanel, { ResumeAssistantMessage } from "./jkResumeAssistantPanel";
import { Sparkles } from "lucide-react";

function newId() {
	return Math.random().toString(36).slice(2);
}

const emptyIR: ResumeIR = {
	personal: { firstName: "", lastName: "", email: "", location: "", links: [] },
	sections: [
		{ kind: "experience", items: [] },
		{ kind: "education", items: [] },
		{ kind: "projects", items: [] },
		{ kind: "skills", tech: [], other: [] },
		{ kind: "additional", items: [] },
	],
	meta: { template: "jake", lastEditedISO: new Date().toISOString() },
};

type AssistantRequest = {
	message: string;
	display?: string;
	includeContext?: boolean;
};

type GenerateOptions = {
	guidance?: string;
	currentValue?: string;
	extraContext?: string;
	postProcess?: (value: string) => string;
};

type PersonalFieldKey = "firstName" | "lastName" | "email" | "location";
type ExperienceFieldKey = "company" | "title" | "start" | "end" | "location";

type AssistantFieldUpdate =
	| { type: "personal"; field: PersonalFieldKey; value: string }
	| { type: "experience"; id: string; field: ExperienceFieldKey; value: string }
	| { type: "experience_bullet"; experienceId: string; bulletId?: string; value: string };

export default function JkCW_ResumeEditor() {
	const [name, setName] = React.useState<string>("Untitled Resume");
	const [resumeIrId, setResumeIrId] = React.useState<string | null>(null);
	const [ir, setIr] = React.useState<ResumeIR>(emptyIR);
	const [isSaving, setIsSaving] = React.useState(false);
	const [saveTick, setSaveTick] = React.useState<null | number>(null);
	const [assistantMessages, setAssistantMessages] = React.useState<ResumeAssistantMessage[]>([
		{
			id: newId(),
			role: "assistant",
			content: "Hey! I'm your resume assistant. Pick any field and tap the sparkles button to generate ideas.",
		},
	]);
	const [assistantLoading, setAssistantLoading] = React.useState(false);

	const assistantMessagesRef = React.useRef<ResumeAssistantMessage[]>(assistantMessages);
	React.useEffect(() => {
		assistantMessagesRef.current = assistantMessages;
	}, [assistantMessages]);

	const saveResumeIR = useMutation(api.documents.saveResumeIR);
	const updateResumeIR = useMutation(api.documents.updateResumeIR);

	// Autosave debounced
	React.useEffect(() => {
		if (!ir) return;
		const handle = setTimeout(async () => {
			setIsSaving(true);
			try {
				const payload = { ...ir, meta: { ...ir.meta, lastEditedISO: new Date().toISOString() } };
				if (resumeIrId) {
					await updateResumeIR({ resumeIrId: resumeIrId as any, name, ir: payload, meta: payload.meta });
				} else {
					const id = await saveResumeIR({ name, ir: payload, meta: payload.meta });
					setResumeIrId(String(id));
				}
				setSaveTick(Date.now());
			} finally {
				setIsSaving(false);
			}
		}, 500);
		return () => clearTimeout(handle);
	}, [ir, name, resumeIrId, saveResumeIR, updateResumeIR]);

	const resumeContext = React.useMemo(() => buildResumeContext(ir), [ir]);

	async function handleDownloadPdf() {
		const response = await fetch("/api/resume/export", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ir }),
		});
		if (!response.ok) {
			console.error("PDF export failed");
			return;
		}
		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "resume.pdf";
		a.click();
		URL.revokeObjectURL(url);
	}

	async function sendAssistantMessage({ message, display, includeContext = true }: AssistantRequest) {
		const finalMessage = includeContext
			? `Resume context:\n${resumeContext}\n\n${message}`
			: message;
		const displayContent = display ?? message;
		const userMessage: ResumeAssistantMessage = {
			id: newId(),
			role: "user",
			content: displayContent,
			internalContent: finalMessage,
		};
		const historyPayload = assistantMessagesRef.current.map(item => ({
			role: item.role,
			content: item.internalContent ?? item.content,
		}));

		setAssistantMessages(prev => [...prev, userMessage]);
		setAssistantLoading(true);

		try {
			const response = await fetch("/api/resume/assist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: finalMessage,
					history: historyPayload,
				}),
			});

			const data = await response.json();
			if (!response.ok || !data?.message) {
				throw new Error(data?.message ?? "Assistant error");
			}

			const cleaned = data.message.trim();
			const { cleanedMessage, updates } = extractUpdatesFromAssistant(cleaned);
			if (updates.length > 0) {
				applyAssistantUpdates(updates);
			}
			const displayText = cleanedMessage.trim() || cleaned;
			const assistantMessage: ResumeAssistantMessage = {
				id: newId(),
				role: "assistant",
				content: displayText,
				internalContent: cleaned,
			};
			setAssistantMessages(prev => [...prev, assistantMessage]);
			return displayText;
		} catch (error) {
			console.error("Resume assistant failed", error);
			const fallback: ResumeAssistantMessage = {
				id: newId(),
				role: "assistant",
				content: "Sorry, I ran into an issue generating that. Please try again.",
				internalContent: "Sorry, I ran into an issue generating that. Please try again.",
			};
			setAssistantMessages(prev => [...prev, fallback]);
			return null;
		} finally {
			setAssistantLoading(false);
		}
	}

	async function handleAssistantSend(content: string) {
		await sendAssistantMessage({ message: content });
	}

	function applyAssistantUpdates(updates: AssistantFieldUpdate[]) {
		if (updates.length === 0) return;
		setIr(prev => {
			let next: ResumeIR = {
				...prev,
				personal: { ...prev.personal },
				sections: prev.sections.map(section => {
					if (section.kind === "experience") {
						return {
							...section,
							items: section.items.map(item => ({
								...item,
								bullets: item.bullets.map(bullet => ({ ...bullet })),
							})),
						};
					}
					return section;
				}) as SectionIR[],
			};

			for (const update of updates) {
				if (update.type === "personal") {
					if (update.field in next.personal) {
						next = {
							...next,
							personal: { ...next.personal, [update.field]: update.value },
						};
					}
					continue;
				}

				const experienceSectionIndex = next.sections.findIndex(s => s.kind === "experience");
				if (experienceSectionIndex === -1) continue;
				const experienceSection = next.sections[experienceSectionIndex] as Extract<SectionIR, { kind: "experience" }>;

				if (update.type === "experience") {
					const itemIndex = experienceSection.items.findIndex(item => item.id === update.id);
					if (itemIndex === -1) continue;
					const items = experienceSection.items.slice();
					const targetItem = { ...items[itemIndex] };
					(targetItem as any)[update.field] = update.value;
					items[itemIndex] = targetItem;
					const updatedSection: SectionIR = { ...experienceSection, items };
					const sections = next.sections.slice();
					sections[experienceSectionIndex] = updatedSection;
					next = { ...next, sections };
					continue;
				}

				if (update.type === "experience_bullet") {
					const itemIndex = experienceSection.items.findIndex(item => item.id === update.experienceId);
					if (itemIndex === -1) continue;
					const items = experienceSection.items.slice();
					const targetItem = { ...items[itemIndex], bullets: items[itemIndex].bullets.map(b => ({ ...b })) };

					if (update.bulletId) {
						const bulletIndex = targetItem.bullets.findIndex(b => b.id === update.bulletId);
						if (bulletIndex !== -1) {
							const bullets = targetItem.bullets.slice();
							bullets[bulletIndex] = { ...bullets[bulletIndex], text: update.value };
							targetItem.bullets = bullets;
						} else {
							targetItem.bullets = [...targetItem.bullets, { id: update.bulletId, text: update.value }];
						}
					} else {
						targetItem.bullets = [...targetItem.bullets, { id: newId(), text: update.value }];
					}

					items[itemIndex] = targetItem;
					const updatedSection: SectionIR = { ...experienceSection, items };
					const sections = next.sections.slice();
					sections[experienceSectionIndex] = updatedSection;
					next = { ...next, sections };
				}
			}

			return next;
		});
	}

	async function handleGenerateField(
		fieldLabel: string,
		applyValue: (value: string) => void,
		options: GenerateOptions = {},
	) {
		const prompt = [
			`You are updating the resume field "${fieldLabel}".`,
			options.guidance ?? "Provide a concise, polished value suitable for a modern resume.",
			options.extraContext ? `Context: ${options.extraContext}` : null,
			options.currentValue ? `Current value: ${options.currentValue}` : null,
			"Respond with only the text that should be inserted into the field.",
		]
			.filter(Boolean)
			.join("\n");

		const result = await sendAssistantMessage({
			message: prompt,
			display: `Generate "${fieldLabel}"`,
		});

		if (result) {
			const processed = options.postProcess ? options.postProcess(result) : sanitizeResponse(result);
			if (processed) {
				applyValue(processed);
			}
		}
	}

	function updatePersonal<K extends keyof ResumeIR["personal"]>(key: K, value: ResumeIR["personal"][K]) {
		setIr(prev => ({ ...prev, personal: { ...prev.personal, [key]: value } }));
	}

	function addExperience() {
		const newItem: ExperienceItemIR = {
			id: newId(),
			company: "",
			title: "",
			start: "",
			end: "Present",
			location: "",
			bullets: [],
		};
		setIr(prev => ({
			...prev,
			sections: prev.sections.map(s => (s.kind === "experience" ? { ...s, items: [...s.items, newItem] } : s)) as SectionIR[],
		}));
	}

	function updateExperienceItem(id: string, patch: Partial<ExperienceItemIR>) {
		setIr(prev => ({
			...prev,
			sections: prev.sections.map(s => {
				if (s.kind !== "experience") return s;
				return { ...s, items: s.items.map(it => (it.id === id ? { ...it, ...patch } : it)) };
			}) as SectionIR[],
		}));
	}

	function addBullet(expId: string) {
		const bullet: BulletIR = { id: newId(), text: "" };
		setIr(prev => ({
			...prev,
			sections: prev.sections.map(s => {
				if (s.kind !== "experience") return s;
				return {
					...s,
					items: s.items.map(it => (it.id === expId ? { ...it, bullets: [...it.bullets, bullet] } : it)),
				};
			}) as SectionIR[],
		}));
	}

	function updateBullet(expId: string, bulletId: string, text: string) {
		setIr(prev => ({
			...prev,
			sections: prev.sections.map(s => {
				if (s.kind !== "experience") return s;
				return {
					...s,
					items: s.items.map(it =>
						it.id === expId
							? { ...it, bullets: it.bullets.map(b => (b.id === bulletId ? { ...b, text } : b)) }
							: it
					),
				};
			}) as SectionIR[],
		}));
	}

	const experienceSection = React.useMemo(() => {
		return ir.sections.find(s => s.kind === "experience") as Extract<SectionIR, { kind: "experience" }> | undefined;
	}, [ir.sections]);

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto flex h-full max-w-6xl flex-col gap-4 px-6 py-6 sm:px-8">
				<header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<Input value={name} onChange={e => setName(e.target.value)} className="w-[260px]" />
						<span className="text-xs text-muted-foreground">
							{isSaving ? "Saving..." : saveTick ? "Saved" : "—"}
						</span>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => setIr(emptyIR)}>New</Button>
						<Button onClick={handleDownloadPdf}>Download PDF</Button>
					</div>
				</header>

				<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
					<section className="rounded-xl border border-border bg-card/70 p-4">
						<h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Editor</h3>
						<div className="space-y-4">
							<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
								<FieldWithGenerate
									renderInput={props => (
										<Input
											{...props}
											placeholder="First name"
											value={ir.personal.firstName}
											onChange={e => updatePersonal("firstName", e.target.value)}
										/>
									)}
									onGenerate={() =>
										handleGenerateField("First name", value => updatePersonal("firstName", value), {
											guidance: "Suggest a professional-sounding first name. Return the name in Title Case.",
											currentValue: ir.personal.firstName,
										})
									}
									label="Generate first name"
								/>
								<FieldWithGenerate
									renderInput={props => (
										<Input
											{...props}
											placeholder="Last name"
											value={ir.personal.lastName}
											onChange={e => updatePersonal("lastName", e.target.value)}
										/>
									)}
									onGenerate={() =>
										handleGenerateField("Last name", value => updatePersonal("lastName", value), {
											guidance: "Suggest a professional last name. Return the name only.",
											currentValue: ir.personal.lastName,
										})
									}
									label="Generate last name"
								/>
								<FieldWithGenerate
									renderInput={props => (
										<Input
											{...props}
											placeholder="Email"
											value={ir.personal.email}
											onChange={e => updatePersonal("email", e.target.value)}
										/>
									)}
									onGenerate={() =>
										handleGenerateField("Email address", value => updatePersonal("email", value), {
											guidance:
												"Create a professional email address using lowercase characters. Do not include commentary.",
											currentValue: ir.personal.email,
										})
									}
									label="Generate email"
								/>
								<FieldWithGenerate
									renderInput={props => (
										<Input
											{...props}
											placeholder="Location"
											value={ir.personal.location ?? ""}
											onChange={e => updatePersonal("location", e.target.value)}
										/>
									)}
									onGenerate={() =>
										handleGenerateField("Location", value => updatePersonal("location", value), {
											guidance: "Suggest a city and state or region. Keep it short.",
											currentValue: ir.personal.location ?? "",
										})
									}
									label="Generate location"
								/>
							</div>

							<div className="mt-4 flex items-center justify-between">
								<h4 className="text-sm font-medium">Experience</h4>
								<Button size="sm" variant="outline" onClick={addExperience}>Add role</Button>
							</div>

							<div className="space-y-4">
								{experienceSection?.items.map(it => (
									<div key={it.id} className="rounded border border-border/70 p-3">
										<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
											<FieldWithGenerate
												renderInput={props => (
													<Input
														{...props}
														placeholder="Company"
														value={it.company}
														onChange={e => updateExperienceItem(it.id, { company: e.target.value })}
													/>
												)}
												onGenerate={() =>
													handleGenerateField("Company", value => updateExperienceItem(it.id, { company: value }), {
														guidance: "Provide the name of a reputable company. Return the company name only.",
														currentValue: it.company,
														extraContext: describeExperienceItem(it),
													})
												}
												label="Generate company name"
											/>
											<FieldWithGenerate
												renderInput={props => (
													<Input
														{...props}
														placeholder="Title"
														value={it.title}
														onChange={e => updateExperienceItem(it.id, { title: e.target.value })}
													/>
												)}
												onGenerate={() =>
													handleGenerateField("Job title", value => updateExperienceItem(it.id, { title: value }), {
														guidance:
															"Craft a strong job title for this experience. Keep it short and capitalized appropriately.",
														currentValue: it.title,
														extraContext: describeExperienceItem(it),
													})
												}
												label="Generate job title"
											/>
											<FieldWithGenerate
												renderInput={props => (
													<Input
														{...props}
														placeholder="Start"
														value={it.start}
														onChange={e => updateExperienceItem(it.id, { start: e.target.value })}
													/>
												)}
												onGenerate={() =>
													handleGenerateField("Start date", value => updateExperienceItem(it.id, { start: value }), {
														guidance:
															"Provide a concise start date (e.g., Jan 2023). Do not include additional words.",
														currentValue: it.start,
														extraContext: describeExperienceItem(it),
													})
												}
												label="Generate start date"
											/>
											<FieldWithGenerate
												renderInput={props => (
													<Input
														{...props}
														placeholder="End"
														value={typeof it.end === "string" ? it.end : ""}
														onChange={e => updateExperienceItem(it.id, { end: e.target.value })}
													/>
												)}
												onGenerate={() =>
													handleGenerateField("End date", value => updateExperienceItem(it.id, { end: value }), {
														guidance:
															"Provide an end date (e.g., Present or Jun 2024). Return just the date or 'Present'.",
														currentValue: typeof it.end === "string" ? it.end : "",
														extraContext: describeExperienceItem(it),
													})
												}
												label="Generate end date"
											/>
											<FieldWithGenerate
												renderInput={props => (
													<Input
														{...props}
														placeholder="Location"
														value={it.location ?? ""}
														onChange={e => updateExperienceItem(it.id, { location: e.target.value })}
													/>
												)}
												onGenerate={() =>
													handleGenerateField("Role location", value => updateExperienceItem(it.id, { location: value }), {
														guidance: "Suggest a city, state, or remote indicator for the role.",
														currentValue: it.location ?? "",
														extraContext: describeExperienceItem(it),
													})
												}
												label="Generate role location"
											/>
										</div>

										<div className="mt-3 flex items-center justify-between">
											<h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bullets</h5>
											<Button size="sm" variant="ghost" onClick={() => addBullet(it.id)}>Add bullet</Button>
										</div>
										<div className="space-y-2">
											{it.bullets.map(bullet => (
												<FieldWithGenerate
													key={bullet.id}
													alignTop
													renderInput={props => (
														<Textarea
															{...props}
															placeholder="Impact-driven bullet..."
															value={bullet.text}
															onChange={e => updateBullet(it.id, bullet.id, e.target.value)}
														/>
													)}
													onGenerate={() =>
														handleGenerateField(
															`Bullet for ${it.title || "this role"}`,
															value => updateBullet(it.id, bullet.id, value),
															{
																guidance:
																	"Write a single impactful bullet that starts with a strong action verb and highlights measurable impact.",
																currentValue: bullet.text,
																extraContext: describeExperienceItem(it),
																postProcess: value => sanitizeResponse(value),
															},
														)
													}
													label="Generate bullet point"
												/>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					</section>
					<ResumeAssistantPanel messages={assistantMessages} onSend={handleAssistantSend} isLoading={assistantLoading} />
				</div>
			</div>
		</div>
	);
}

function sanitizeResponse(text: string): string {
	const trimmed = text.trim();
	const withoutQuotes = trimmed.replace(/^["'`]+|["'`]+$/g, "");
	return withoutQuotes.replace(/^[•\-–\s]+/, "").trim();
}

function buildResumeContext(ir: ResumeIR): string {
	const personalParts = [
		`${ir.personal.firstName} ${ir.personal.lastName}`.trim(),
		ir.personal.location,
	]
		.filter(Boolean)
		.join(" | ");

	const experienceSection = ir.sections.find(s => s.kind === "experience") as Extract<SectionIR, { kind: "experience" }> | undefined;
	const experienceLines = experienceSection?.items.slice(0, 4).map(it => {
		const dates = [it.start, typeof it.end === "string" ? it.end : ""].filter(Boolean).join(" – ");
		return `${it.title || "Role"} at ${it.company || "Company"} (${dates || "Dates TBC"})`;
	});
	const experienceStructure = experienceSection
		? JSON.stringify(
				experienceSection.items.map(it => ({
					id: it.id,
					company: it.company,
					title: it.title,
					start: it.start,
					end: typeof it.end === "string" ? it.end : "",
					location: it.location ?? "",
					bullets: it.bullets.map(b => ({ id: b.id, text: b.text })),
				})),
				null,
				2,
		  )
		: null;

	return [
		personalParts ? `Personal: ${personalParts}` : null,
		experienceLines && experienceLines.length > 0
			? `Experience:\n${experienceLines.map(line => `- ${line}`).join("\n")}`
			: null,
		experienceStructure ? `Experience structure JSON:\n${experienceStructure}` : null,
	]
		.filter(Boolean)
		.join("\n\n");
}

function describeExperienceItem(it: ExperienceItemIR): string {
	const dates = [it.start, typeof it.end === "string" ? it.end : ""].filter(Boolean).join(" – ");
	const bullets = it.bullets
		.filter(b => b.text.trim())
		.slice(0, 3)
		.map(b => b.text.trim())
		.join(" | ");
	return [
		it.title ? `Title: ${it.title}` : null,
		it.company ? `Company: ${it.company}` : null,
		dates ? `Dates: ${dates}` : null,
		it.location ? `Location: ${it.location}` : null,
		bullets ? `Existing bullets: ${bullets}` : null,
	]
		.filter(Boolean)
		.join("; ");
}

interface FieldWithGenerateProps {
	renderInput: (props: { className?: string }) => React.ReactNode;
	onGenerate: () => void;
	label: string;
	alignTop?: boolean;
}

function FieldWithGenerate({ renderInput, onGenerate, label, alignTop = false }: FieldWithGenerateProps) {
	return (
		<div className={`flex gap-2 ${alignTop ? "items-start" : "items-center"}`}>
			<div className="flex-1">{renderInput({ className: "w-full" })}</div>
			<Button
				type="button"
				variant="outline"
				size="icon"
				className={alignTop ? "mt-1 shrink-0" : "shrink-0"}
				onClick={onGenerate}
				aria-label={label}
				title={label}
			>
				<Sparkles className="h-4 w-4" />
			</Button>
		</div>
	);
}

function extractUpdatesFromAssistant(message: string): { cleanedMessage: string; updates: AssistantFieldUpdate[] } {
	const updates: AssistantFieldUpdate[] = [];
	const fencedRegex = /```updates\s*([\s\S]*?)```/i;
	const match = message.match(fencedRegex);
	let cleaned = message;
	const allowedPersonalFields: readonly PersonalFieldKey[] = ["firstName", "lastName", "email", "location"];
	const allowedExperienceFields: readonly ExperienceFieldKey[] = ["company", "title", "start", "end", "location"];

	if (match) {
		const raw = match[1].trim();
		cleaned = message.replace(match[0], "").trim();
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				for (const entry of parsed) {
					if (!entry || typeof entry !== "object") continue;
					if (
						entry.type === "personal" &&
						typeof entry.field === "string" &&
						typeof entry.value === "string" &&
						(allowedPersonalFields as readonly string[]).includes(entry.field)
					) {
						const value = entry.value.trim();
						if (!value) continue;
						updates.push({
							type: "personal",
							field: entry.field as PersonalFieldKey,
							value,
						});
					} else if (
						entry.type === "experience" &&
						typeof entry.id === "string" &&
						typeof entry.field === "string" &&
						typeof entry.value === "string" &&
						(allowedExperienceFields as readonly string[]).includes(entry.field)
					) {
						const value = entry.value.trim();
						if (!value) continue;
						updates.push({
							type: "experience",
							id: entry.id,
							field: entry.field as ExperienceFieldKey,
							value,
						});
					} else if (
						entry.type === "experience_bullet" &&
						typeof entry.experienceId === "string" &&
						typeof entry.value === "string"
					) {
						const value = entry.value.trim();
						if (!value) continue;
						updates.push({
							type: "experience_bullet",
							experienceId: entry.experienceId,
							bulletId: typeof entry.bulletId === "string" ? entry.bulletId : undefined,
							value,
						});
					}
				}
			}
		} catch (error) {
			console.error("Failed to parse assistant updates", error);
		}
	}

	return { cleanedMessage: cleaned, updates };
}

