'use client'

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type ResumeAssistantMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	internalContent?: string;
};

interface ResumeAssistantPanelProps {
	messages: ResumeAssistantMessage[];
	onSend: (content: string) => Promise<void>;
	isLoading: boolean;
}

export default function ResumeAssistantPanel({ messages, onSend, isLoading }: ResumeAssistantPanelProps) {
	const [draft, setDraft] = React.useState('');
	const scrollRef = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages, isLoading]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmed = draft.trim();
		if (!trimmed) return;
		setDraft('');
		await onSend(trimmed);
	}

	return (
		<div className="flex h-full flex-col rounded-xl border border-border bg-card/70 p-4">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">AI Assistant</h3>
				<span className="text-xs text-muted-foreground">{isLoading ? 'Replying…' : 'Ready'}</span>
			</div>

			<div className="flex-1 overflow-y-auto pr-2">
				<div className="space-y-3 text-sm">
					{messages.map(message => (
						<div
							key={message.id}
							className={`max-w-full rounded-lg px-3 py-2 ${
								message.role === 'assistant'
									? 'bg-muted text-foreground'
									: 'bg-primary/10 text-foreground'
							}`}
						>
							{message.content}
						</div>
					))}
					{isLoading && (
						<div className="max-w-full rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
							Thinking…
						</div>
					)}
					<div ref={scrollRef} />
				</div>
			</div>

			<form onSubmit={handleSubmit} className="mt-3 flex gap-2">
				<Input
					value={draft}
					onChange={event => setDraft(event.target.value)}
					placeholder="Ask for help with your resume…"
					className="flex-1"
				/>
				<Button type="submit" disabled={!draft.trim() || isLoading}>
					Send
				</Button>
			</form>
		</div>
	);
}


