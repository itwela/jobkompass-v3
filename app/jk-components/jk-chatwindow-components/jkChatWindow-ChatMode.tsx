'use client'

/**
 * Chat (D01 new chat, D02 resume written; M03, M04, M05 on phones).
 * - No thread: JkChatHero (painting band, composer, action cards, context counts).
 * - Thread: header + messages + docked composer; when the chat has written documents, the
 *   Artifacts panel sits on the right from 1280px, and "Open" shows the changes sheet below that.
 */
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { useAuth } from "@/providers/jkAuthProvider";
import { useJobs } from "@/providers/jkJobsProvider";
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { LogIn, AlertTriangle, MessageSquarePlus } from "lucide-react";
import JkSlideModalGlass from "../jkSlideModalGlass";
import { Button } from "@/components/ui/button";
import { rateLimitMessageFromResponse } from "@/lib/rateLimit/message";
import JkInputSection from "../jkInputSection";
import JkChatThreadMenu from "../jk-app/jkChatThreadMenu";
import JkChatHero, { JkChatJobPicker, jkFirstName, useBaseResumeId, type JkChatAction } from "../jk-chat/jkChatHero";
import { JkChatArtifactsPanel, JkChatChangesSheet, JkChatResultCard } from "../jk-chat/jkChatResume";
import JkResumeQuestionsCard from "../jk-resume-questions/jkResumeQuestionsCard";
import { usableScorecard } from "../jk-resume-questions/types";
import { traceSteps, turnArtifacts, type ChatArtifact, type ChatToolCall, type TraceStep } from "@/lib/chat/toolTrace";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ChatToolCall[];
  file?: { name: string; type: string; isImage: boolean };
}

type SendOverrides = { text: string; resumeIds?: string[]; jobIds?: string[] };

const TICK: Record<TraceStep["tone"], string> = {
  "bar-1": "bg-bar-1", "bar-2": "bg-bar-2", "bar-3": "bg-bar-3", "bar-4": "bg-bar-4", ok: "bg-ok", destructive: "bg-destructive",
};

/** The four logo bars before "JobKompass". */
function BrandBars({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("flex gap-[3px]", className)}>
      {["bg-bar-1", "bg-bar-2", "bg-bar-3", "bg-bar-4"].map((c) => <span key={c} className={cn("h-[13px] w-[3px] rounded-full", c)} />)}
    </span>
  );
}

function TraceLine({ tone, children }: { tone: TraceStep["tone"]; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-[13px] font-mono text-[11.5px] leading-[15px] text-muted-foreground sm:text-[12.5px] sm:leading-[17px]">
      <span aria-hidden className={cn("mt-px h-[14px] w-[3px] shrink-0 rounded-full", TICK[tone])} />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

const markdown = {
  h1: (p: any) => <h1 className="mb-3 mt-6 text-[22px] font-medium tracking-[-0.3px]" {...p} />,
  h2: (p: any) => <h2 className="mb-2 mt-5 text-[19px] font-medium" {...p} />,
  h3: (p: any) => <h3 className="mb-2 mt-4 text-[17px] font-medium" {...p} />,
  h4: (p: any) => <h4 className="mb-1 mt-3 text-[15.5px] font-medium" {...p} />,
  p: (p: any) => <p className="mb-3 last:mb-0" {...p} />,
  ul: (p: any) => <ul className="mb-3 list-disc space-y-1 pl-5" {...p} />,
  ol: (p: any) => <ol className="mb-3 list-decimal space-y-1 pl-5" {...p} />,
  li: (p: any) => <li className="pl-1" {...p} />,
  code: ({ inline, ...p }: any) => inline
    ? <code className="rounded bg-popover px-1.5 py-0.5 font-mono text-[13px]" {...p} />
    : <code className="block overflow-x-auto font-mono text-[13px]" {...p} />,
  pre: (p: any) => <pre className="mb-3 overflow-x-auto rounded-[12px] border border-border bg-popover p-3" {...p} />,
  blockquote: (p: any) => <blockquote className="my-3 border-l-[3px] border-bar-3 pl-4 text-muted-foreground" {...p} />,
  a: (p: any) => <a className="underline decoration-bar-3 underline-offset-2 hover:text-bar-3" target="_blank" rel="noopener noreferrer" {...p} />,
  table: (p: any) => <div className="my-4 overflow-x-auto"><table className="min-w-full border-collapse text-[14px]" {...p} /></div>,
  th: (p: any) => <th className="border border-border bg-popover px-3 py-2 text-left font-medium" {...p} />,
  td: (p: any) => <td className="border border-border px-3 py-2" {...p} />,
  strong: (p: any) => <strong className="font-semibold" {...p} />,
};

/** True from 1280px, where the Artifacts panel sits beside the conversation. */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

export default function JkCW_ChatMode() {
    const {
        textValue, setTextValue, textareaRef, currentThreadId, setCurrentThreadId,
        attachedResumeIds, attachedJobIds, clearAllAttachments, setAttachedJobIds, setAttachedResumeIds,
        selectedResumeTemplateId,
        droppedFile, setDroppedFile, fileName, setFileName, setIsFileMode,
        allModes, setCurrentMode, setSelectedInterviewPrepJobId,
    } = useJobKompassChatWindow()
    const { user, isAuthenticated, isLoading: authLoading } = useAuth()
    const { allJobs } = useJobs()
    const baseResumeId = useBaseResumeId()
    const wide = useWide()
    const searchParams = useSearchParams()

    // Keep the open conversation in the URL, so a refresh or a shared link reopens it.
    useEffect(() => {
        const url = new URL(window.location.href)
        if (currentThreadId) { url.searchParams.set('mode', 'chat'); url.searchParams.set('thread', currentThreadId) }
        else url.searchParams.delete('thread')
        window.history.replaceState(window.history.state, '', url)
    }, [currentThreadId])

    // Deep link: /app?mode=chat&thread=<id> opens that conversation.
    useEffect(() => {
        const t = searchParams.get('thread')
        if (t) setCurrentThreadId(t as Id<"threads">)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [contextExceeded, setContextExceeded] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const [isUserNearBottom, setIsUserNearBottom] = useState(true)
    const [hasNewMessages, setHasNewMessages] = useState(false)
    const lastThreadIdRef = useRef<string | null>(null)
    const pendingScrollRef = useRef(false)
    const [picker, setPicker] = useState<null | "tailor" | "letter" | "prep">(null)
    // Scorecards from answering a resume's questions, by artifact key (the resume itself
    // updates through the live document).
    const [scores, setScores] = useState<Record<string, ChatArtifact["scorecard"]>>({})
    const withScore = useCallback((a: ChatArtifact): ChatArtifact => (scores[a.key] ? { ...a, scorecard: scores[a.key] } : a), [scores])
    const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null)
    const [sheetArtifact, setSheetArtifact] = useState<string | null>(null)

    const createThread = useMutation(api.threads.create)
    const addMessage = useMutation(api.threads.addMessage)
    const markContextWindowExceeded = useMutation(api.threads.markContextWindowExceeded)

    const threadData = useQuery(api.threads.get, currentThreadId ? { threadId: currentThreadId } : "skip")

    useEffect(() => {
        if (currentThreadId && threadData?.messages) {
            const loaded: ChatMessage[] = threadData.messages.map((msg: any) => ({
                id: msg._id,
                type: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: new Date(msg.createdAt),
                toolCalls: msg.toolCalls,
            }))
            // While a reply streams, keep the local copy (it has the placeholder message).
            if (!isLoading) setMessages(loaded)
            setContextExceeded(threadData.thread?.contextWindowExceeded ?? false)
            if (pendingScrollRef.current) {
                pendingScrollRef.current = false
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
                    setIsUserNearBottom(true)
                    setHasNewMessages(false)
                }))
            }
        } else if (!currentThreadId) {
            setMessages([])
            setContextExceeded(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threadData, currentThreadId])

    useEffect(() => {
        if (!currentThreadId) return
        if (lastThreadIdRef.current !== currentThreadId) {
            lastThreadIdRef.current = currentThreadId
            pendingScrollRef.current = true
            setSelectedArtifact(null)
        }
    }, [currentThreadId])

    const handleMessagesScroll = () => {
        const c = messagesContainerRef.current
        if (!c) return
        const near = c.scrollHeight - c.scrollTop - c.clientHeight <= 80
        setIsUserNearBottom(near)
        if (near) setHasNewMessages(false)
    }

    // Keep the newest message in view while the person is at the bottom.
    useEffect(() => {
        if (isUserNearBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, [messages, isLoading, isUserNearBottom])

    /** Sends the composer text, or an explicit message + context when a card or button starts a flow. */
    const sendMessage = async (override?: SendOverrides) => {
        const currentTextValue = (override?.text ?? textValue).trim()
        if ((!currentTextValue && !droppedFile) || isLoading || !isAuthenticated || contextExceeded) return

        const currentFile = override ? null : droppedFile
        const resumeIds = override?.resumeIds ?? attachedResumeIds
        const jobIds = override?.jobIds ?? attachedJobIds

        let activeThreadId = currentThreadId
        if (!activeThreadId) {
            try {
                const title = currentTextValue.length > 50 ? currentTextValue.slice(0, 50) + '...' : currentTextValue
                activeThreadId = await createThread({ title })
                lastThreadIdRef.current = activeThreadId
                setCurrentThreadId(activeThreadId)
            } catch (err) {
                console.error('Failed to create thread:', err)
                setError('Could not start the conversation. Try again.')
                return
            }
        }

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: currentTextValue,
            timestamp: new Date(),
            file: currentFile ? { name: currentFile.name, type: currentFile.type, isImage: currentFile.type.startsWith('image/') } : undefined,
        }
        const priorMessages = messages
        setMessages(prev => [...prev, userMessage])
        if (!override) setTextValue('')
        setIsLoading(true)
        setError(null)
        setIsUserNearBottom(true)

        try {
            await addMessage({ threadId: activeThreadId, role: 'user', content: currentTextValue })
        } catch (err) {
            console.error('Failed to save user message:', err)
        }

        const tempMessageId = (Date.now() + 1).toString()
        setMessages(prev => [...prev, { id: tempMessageId, type: 'assistant', content: '', timestamp: new Date() }])

        let fileData = null
        if (currentFile) {
            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve((reader.result as string).split(',')[1])
                    reader.onerror = reject
                    reader.readAsDataURL(currentFile)
                })
                fileData = { name: currentFile.name, type: currentFile.type, size: currentFile.size, base64 }
            } catch (err) {
                console.error('Failed to read file:', err)
                setError('That file could not be read.')
                setIsLoading(false)
                return
            }
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: currentTextValue,
                    file: fileData,
                    history: priorMessages.map(msg => ({ role: msg.type === 'user' ? 'user' : 'assistant', content: msg.content })),
                    agentId: 'jobkompass',
                    userId: user?._id,
                    username: user?.username || user?.email || undefined,
                    contextResumeIds: resumeIds.length > 0 ? resumeIds : undefined,
                    contextJobIds: jobIds.length > 0 ? jobIds : undefined,
                    contextResumeTemplateId: selectedResumeTemplateId ?? undefined,
                })
            })

            clearAllAttachments()

            if (response.status === 429) {
                setError(rateLimitMessageFromResponse(response))
                setIsLoading(false)
                setMessages(prev => prev.filter(msg => msg.id !== tempMessageId))
                return
            }

            if (!response.ok) {
                try {
                    const errorData = await response.json()
                    if (errorData.errorCode === 'CONTEXT_LENGTH_EXCEEDED') {
                        setContextExceeded(true)
                        setIsLoading(false)
                        setMessages(prev => prev.filter(msg => msg.id !== tempMessageId))
                        if (activeThreadId) await markContextWindowExceeded({ threadId: activeThreadId, exceeded: true })
                        return
                    }
                } catch {
                    // fall through
                }
                throw new Error(`The reply failed (${response.status}). Try again.`)
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let fullContent = ''
            let toolCallsData: ChatToolCall[] | undefined = undefined
            if (!reader) throw new Error('No reader available')

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')
                buffer = lines.pop() || ''
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const data = JSON.parse(line.slice(6))
                    if (data.type === 'start') {
                        toolCallsData = data.toolCalls
                        setMessages(prev => prev.map(msg => msg.id === tempMessageId ? { ...msg, toolCalls: data.toolCalls } : msg))
                    } else if (data.type === 'token') {
                        fullContent += data.content
                        setMessages(prev => prev.map(msg => msg.id === tempMessageId ? { ...msg, content: fullContent } : msg))
                    } else if (data.type === 'done') {
                        if (activeThreadId && fullContent) {
                            try {
                                await addMessage({ threadId: activeThreadId, role: 'assistant', content: fullContent, toolCalls: toolCallsData as any })
                            } catch (err) {
                                console.error('Failed to save assistant message:', err)
                            }
                        }
                        setIsLoading(false)
                    }
                }
            }
            setIsLoading(false)

            if (currentFile) {
                setDroppedFile(null)
                setFileName(null)
                setIsFileMode(false)
            }
        } catch (err) {
            console.error('Chat error:', err)
            setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
            setIsLoading(false)
            setMessages(prev => prev.filter(msg => msg.id !== tempMessageId))
            if (currentFile) {
                setDroppedFile(null)
                setFileName(null)
                setIsFileMode(false)
            }
        }
    }

    // The composer sends through this event (it lives in a separate component).
    const sendRef = useRef(sendMessage)
    sendRef.current = sendMessage
    useEffect(() => {
        const handler = () => { void sendRef.current() }
        window.addEventListener('jk:sendChat', handler as EventListener)
        return () => window.removeEventListener('jk:sendChat', handler as EventListener)
    }, [])

    const clearChat = () => {
        setMessages([])
        setError(null)
        setContextExceeded(false)
        setCurrentThreadId(null)
    }

    const jobById = useCallback((id: string) => allJobs.find(j => String(j._id) === id), [allJobs])

    // Action cards (D01) and the result card's "Write the cover letter" start real flows.
    const onAction = (a: JkChatAction) => {
        if (a === 'save') {
            setTextValue('Save this job to My Jobs: ')
            requestAnimationFrame(() => textareaRef.current?.focus())
            return
        }
        setPicker(a)
    }

    const onPickJob = (jobId: string) => {
        const job = jobById(jobId)
        const kind = picker
        setPicker(null)
        if (!job || !kind) return
        if (kind === 'prep') {
            setSelectedInterviewPrepJobId(job._id)
            const prep = allModes.find(m => m.id === '/interview-prep')
            if (prep) setCurrentMode(prep)
            return
        }
        const resumeIds = baseResumeId ? [baseResumeId] : []
        const text = kind === 'tailor'
            ? `Tailor my resume to the ${job.title} role at ${job.company}.`
            : `Write a cover letter for the ${job.title} role at ${job.company}.`
        setAttachedJobIds([]); setAttachedResumeIds([])
        void sendMessage({ text, jobIds: [String(job._id)], resumeIds })
    }

    const writeLetterFor = (artifact: ChatArtifact) => {
        const t = artifact.tailoring
        const role = t?.jobTitle && t?.jobCompany ? ` for the ${t.jobTitle} role at ${t.jobCompany}` : ''
        void sendMessage({
            text: `Write the cover letter${role}.`,
            jobIds: t?.jobId ? [t.jobId] : [],
            resumeIds: artifact.resumeId ? [artifact.resumeId] : [],
        })
    }

    // Every document this conversation wrote, oldest first.
    const artifacts = useMemo(() => messages.flatMap(m => m.type === 'assistant' ? turnArtifacts(m.toolCalls).map(withScore) : []), [messages, withScore])
    const lastArtifactKey = artifacts[artifacts.length - 1]?.key ?? null
    useEffect(() => { setSelectedArtifact(lastArtifactKey) }, [lastArtifactKey])
    const showPanel = wide && artifacts.length > 0
    const openArtifact = (key: string) => (wide ? setSelectedArtifact(key) : setSheetArtifact(key))
    const sheet = artifacts.find(a => a.key === sheetArtifact)

    const latestJob = [...artifacts].reverse().find(a => a.tailoring?.jobCompany || a.tailoring?.jobTitle)?.tailoring
    const threadTitle = threadData?.thread?.title ?? messages.find(m => m.type === 'user')?.content ?? 'Chat'

    if (authLoading) {
        return <div className="flex h-full items-center justify-center"><p className="font-mono text-[12px] uppercase tracking-[0.12em] text-subtle-foreground">Loading</p></div>
    }

    if (!isAuthenticated) {
        return (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <h2 className="text-[28px] font-medium tracking-[-0.5px] text-foreground">Sign in to chat</h2>
                <p className="mt-2 max-w-md text-[15px] text-muted-foreground">Your resumes and saved jobs come with you into every conversation.</p>
                <Button className="mt-6 h-11 px-6" onClick={() => window.dispatchEvent(new CustomEvent('jk:openSignIn'))}>
                    <LogIn className="size-4" /> Sign in
                </Button>
            </div>
        )
    }

    const firstName = jkFirstName(user?.name) || jkFirstName(user?.username)
    const inThread = messages.length > 0

    return (
        <div className="relative flex h-full min-h-0">
            <JkSlideModalGlass
                isOpen={contextExceeded}
                title="Conversation limit reached"
                minimizedText="Context limit reached"
                description="This conversation is too long for the AI to read in full. You can still read it here; start a new conversation to keep going."
                icon={AlertTriangle}
                variant="amber"
                actionText="Start a new conversation"
                actionIcon={MessageSquarePlus}
                onAction={clearChat}
            />

            <section className="flex min-w-0 flex-1 flex-col">
                {inThread && (
                    <header className="hidden h-[78px] shrink-0 items-center gap-4 border-b border-border px-8 lg:flex">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[16px] font-medium leading-[19px] text-foreground">{threadTitle}</p>
                            <p className="mt-[5px] truncate font-mono text-[10.5px] uppercase leading-[14px] tracking-[0.11em] text-subtle-foreground">
                                Chat{latestJob ? ` · ${[latestJob.jobCompany, latestJob.jobTitle].filter(Boolean).join(' ')}` : ` · ${messages.length} messages`}
                            </p>
                        </div>
                        <JkChatThreadMenu />
                    </header>
                )}

                <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="chat-scroll min-h-0 flex-1 overflow-y-auto">
                    {!inThread ? (
                        <JkChatHero firstName={firstName} onAction={onAction} busy={isLoading} />
                    ) : (
                        <div key={currentThreadId ?? 'new'} data-enter className="mx-auto w-full max-w-[680px] px-5 pb-8 pt-[18px] sm:px-8 sm:pt-[22px]">
                            {messages.map((message, idx) => {
                                if (message.type === 'user') {
                                    return (
                                        <div key={message.id} className={cn("jk-enter flex justify-end", idx > 0 && "mt-10")} style={{ "--i": Math.min(idx, 4) } as React.CSSProperties}>
                                            <div className="max-w-[min(440px,78%)] rounded-[20px] bg-accent px-[18px] py-[13px] text-[14.5px] leading-[22px] text-foreground sm:px-5 sm:py-[15px] sm:text-[14px]">
                                                {message.file && <p className="mb-1 font-mono text-[11px] text-muted-foreground">File · {message.file.name}</p>}
                                                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                            </div>
                                        </div>
                                    )
                                }
                                const steps = traceSteps(message.toolCalls)
                                const docs = turnArtifacts(message.toolCalls).map(withScore)
                                const streaming = isLoading && idx === messages.length - 1
                                return (
                                    <div key={message.id} className="jk-enter mt-[30px]" style={{ "--i": Math.min(idx, 4) } as React.CSSProperties}>
                                        <p className="flex items-center gap-[11px]">
                                            <BrandBars className={cn(streaming && !message.content && "animate-pulse")} />
                                            <span className="text-[14px] font-semibold leading-[17px] text-foreground">JobKompass</span>
                                        </p>
                                        {steps.length > 0 && (
                                            <div className="mt-[15px] space-y-[11px]">
                                                {steps.map((s, i) => <TraceLine key={i} tone={s.tone}>{s.text}</TraceLine>)}
                                            </div>
                                        )}
                                        {streaming && !message.content && steps.length === 0 && (
                                            <div className="mt-[15px]"><TraceLine tone="bar-3">Working on it</TraceLine></div>
                                        )}
                                        {message.content && (
                                            <div className="mt-[22px] break-words text-[15px] leading-[22.5px] text-foreground sm:text-[15.5px] sm:leading-[24px]">
                                                <ReactMarkdown components={markdown}>{message.content}</ReactMarkdown>
                                            </div>
                                        )}
                                        {docs.map(doc => (
                                            <div key={doc.key} className="mt-[38px] sm:mt-[38px]">
                                                <JkChatResultCard
                                                    artifact={doc}
                                                    onOpen={() => openArtifact(doc.key)}
                                                    onWriteLetter={doc.kind === 'resume' && !isLoading ? () => writeLetterFor(doc) : undefined}
                                                />
                                                {doc.linkedToJob && doc.tailoring?.jobTitle && (
                                                    <div className="mt-[18px]">
                                                        <TraceLine tone="ok">
                                                            <span className="hidden sm:inline">Linked to {doc.tailoring.jobTitle} in My Jobs</span>
                                                            <span className="sm:hidden">Linked to this job in My Jobs</span>
                                                        </TraceLine>
                                                    </div>
                                                )}
                                                {doc.kind === 'resume' && doc.resumeId && (doc.questions?.length ?? 0) > 0 && !streaming && (
                                                    <JkResumeQuestionsCard
                                                        className="mt-[18px]"
                                                        resumeId={doc.resumeId}
                                                        questions={doc.questions!}
                                                        onUpdated={(r) => { const sc = usableScorecard(r.scorecard); if (sc) setScores(prev => ({ ...prev, [doc.key]: sc })) }}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            })}

                            {error && (
                                <div className="mt-6 rounded-[14px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-[14px] text-foreground">{error}</div>
                            )}

                            {hasNewMessages && !isUserNearBottom && (
                                <div className="pointer-events-none sticky bottom-4 z-10 flex justify-center">
                                    <button type="button" className="pointer-events-auto rounded-full border border-input bg-card px-3 py-1.5 text-[12px] text-foreground hover:bg-accent"
                                        onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setHasNewMessages(false); setIsUserNearBottom(true) }}>
                                        New message
                                    </button>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {inThread && (
                    <div className="mx-auto w-full max-w-[680px] shrink-0 px-5 pb-4 pt-2 sm:px-8 lg:pb-[88px]">
                        <JkInputSection variant="dock" busy={isLoading || contextExceeded} />
                    </div>
                )}
            </section>

            {showPanel && (
                <aside className="hidden w-[40vw] max-w-[576px] shrink-0 border-l border-border xl:block">
                    <JkChatArtifactsPanel artifacts={artifacts} selectedKey={selectedArtifact} onSelect={setSelectedArtifact} />
                </aside>
            )}

            {sheet && <JkChatChangesSheet artifact={sheet} onClose={() => setSheetArtifact(null)} />}

            <JkChatJobPicker
                open={picker !== null}
                title={picker === 'tailor' ? 'Tailor a resume to…' : picker === 'letter' ? 'Write a cover letter for…' : 'Build a prep deck for…'}
                onPick={onPickJob}
                onClose={() => setPicker(null)}
                onSaveJob={() => { setPicker(null); onAction('save') }}
            />
        </div>
    )
}
