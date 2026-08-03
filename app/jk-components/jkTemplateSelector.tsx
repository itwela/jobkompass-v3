'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, FileText, FileCheck, Sparkles, Upload, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    getAppResumeTemplateOptions,
    COVER_LETTER_TEMPLATES,
    type Template,
    type TemplateType,
} from '@/lib/templates'
import { getModelForTemplateGeneration } from '@/lib/aiModels'
import { resolveInitialTemplateId, templatePreferenceKey } from '@/lib/resume/templatePreference'
import { toast } from '@/lib/toast'

export type { TemplateType, Template }
export const resumeTemplates = getAppResumeTemplateOptions()
export const coverLetterTemplates = COVER_LETTER_TEMPLATES

export type ResumeInputMode = 'reference' | 'upload' | 'paste';

export interface ResumeInputOptions {
    referenceResumeId?: string | null
    resumePdf?: string
    resumeText?: string
    promptText?: string
}

interface JkTemplateSelectorProps {
    isOpen: boolean
    onClose: () => void
    type: TemplateType
    onSelectTemplate: (templateId: string, resumeInput?: ResumeInputOptions) => void
    selectedReferenceResumeId?: string | null
    onSelectReferenceResume?: (resumeId: string) => void
    referenceResumes?: Array<{ id: string; name: string }>
    isGenerating?: boolean
    jobTitle?: string
    jobCompany?: string
}

function readStoredTemplateId(type: TemplateType): string | null {
    try {
        return window.localStorage.getItem(templatePreferenceKey(type))
    } catch {
        return null
    }
}

function writeStoredTemplateId(type: TemplateType, templateId: string) {
    try {
        window.localStorage.setItem(templatePreferenceKey(type), templateId)
    } catch {
        // Blocked or unavailable storage: the preference just won't persist.
    }
}

export default function JkTemplateSelector({
    isOpen,
    onClose,
    type,
    onSelectTemplate,
    selectedReferenceResumeId,
    onSelectReferenceResume,
    referenceResumes = [],
    isGenerating = false,
    jobTitle,
    jobCompany,
}: JkTemplateSelectorProps) {
    const templates = type === 'resume' ? resumeTemplates : coverLetterTemplates
    const typeLabel = type === 'resume' ? 'Resume' : 'Cover Letter'
    const Icon = type === 'resume' ? FileText : FileCheck

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [restoredFromPreference, setRestoredFromPreference] = useState(false)
    const [resumeInputMode, setResumeInputMode] = useState<ResumeInputMode>('reference')
    const [resumePdf, setResumePdf] = useState<string | null>(null)
    const [resumePdfName, setResumePdfName] = useState<string | null>(null)
    const [resumeText, setResumeText] = useState('')
    const [promptText, setPromptText] = useState('')
    const [descriptionExpanded, setDescriptionExpanded] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Pre-select the last template the user generated with (validated against the current
    // allowlist), falling back to the first template. Storage is read here rather than in a
    // useState initialiser so it never runs during render and can't desync hydration.
    useEffect(() => {
        if (isOpen) {
            if (templates.length > 0) {
                const { templateId, wasRemembered } = resolveInitialTemplateId(
                    readStoredTemplateId(type),
                    templates.map((t) => t.id),
                    templates[0].id,
                )
                setSelectedTemplateId(templateId)
                setRestoredFromPreference(wasRemembered)
            }
        } else {
            setSelectedTemplateId(null)
            setRestoredFromPreference(false)
            setResumeInputMode('reference')
            setResumePdf(null)
            setResumePdfName(null)
            setResumeText('')
            setPromptText('')
            setDescriptionExpanded(false)
        }
    }, [isOpen])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.type !== 'application/pdf') {
            toast.error('Please upload a PDF file')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('PDF must be under 5MB')
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            const base64 = result.includes(',') ? result.split(',')[1]! : result
            setResumePdf(base64)
            setResumePdfName(file.name)
        }
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    const clearPdf = () => {
        setResumePdf(null)
        setResumePdfName(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const hasResumeInput = type === 'resume'
        ? (resumeInputMode === 'reference' && referenceResumes.length > 0 && !!selectedReferenceResumeId) ||
          (resumeInputMode === 'upload' && !!resumePdf) ||
          (resumeInputMode === 'paste' && !!resumeText.trim())
        : true

    const handleUseTemplate = () => {
        if (!selectedTemplateId) return
        if (type === 'resume' && !hasResumeInput) return
        if (isGenerating) return

        const resumeInput: ResumeInputOptions | undefined = type === 'resume' ? {
            referenceResumeId: resumeInputMode === 'reference' ? selectedReferenceResumeId ?? undefined : undefined,
            resumePdf: resumeInputMode === 'upload' && resumePdf ? resumePdf : undefined,
            resumeText: resumeInputMode === 'paste' && resumeText.trim() ? resumeText.trim() : undefined,
            promptText: resumeInputMode === 'paste' ? (promptText.trim() || undefined) : undefined,
        } : undefined

        writeStoredTemplateId(type, selectedTemplateId)
        onSelectTemplate(selectedTemplateId, resumeInput)
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute !no-scrollbar inset-0 z-50 flex items-center justify-center bg-black/0 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className="relative !no-scrollbar flex flex-col justify-between w-full max-w-4xl max-h-[80vh] h-full bg-background border border-border rounded-xl shadow-2xl !no-scrollbar"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-5 !no-scrollbar flex items-center justify-between px-5 py-4 border-b w-full">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-primary/10 rounded-md">
                                    <Icon className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold">Select {typeLabel} Template</h2>
                                    {jobTitle && jobCompany && (
                                        <p className="text-xs text-muted-foreground">
                                            For: {jobTitle} at {jobCompany}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="h-8 w-8 rounded-full"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Resume Input */}
                        <div className="p-6 w-full h-full overflow-y-auto !no-scrollbar flex flex-col gap-5">
                            {templates.length > 1 && (
                                <div className="space-y-3">
                                    <label className="text-sm font-medium block">Choose a template</label>
                                    <div className="flex flex-row gap-3 overflow-x-auto no-scrollbar pb-1">
                                        {templates.map((template, index) => {
                                            const isSelected = selectedTemplateId === template.id
                                            return (
                                                <motion.button
                                                    key={template.id}
                                                    type="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() => setSelectedTemplateId(template.id)}
                                                    className={`relative flex flex-col flex-shrink-0 w-[180px] rounded-xl border-2 overflow-hidden transition-colors duration-200 text-left group ${
                                                        isSelected
                                                            ? 'border-primary ring-2 ring-primary/40'
                                                            : 'border-border hover:border-primary/60'
                                                    }`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.4, delay: 0.1 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                                >
                                                    <div className="relative w-full aspect-[3/4] bg-muted/30">
                                                        <Image
                                                            src={template.previewImage}
                                                            alt={template.name}
                                                            fill
                                                            className="object-cover object-top"
                                                            sizes="180px"
                                                        />
                                                        <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-opacity" />
                                                    </div>
                                                    <div className="p-2.5 bg-background/95 backdrop-blur-sm flex-shrink-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="font-medium text-xs truncate flex-1">{template.name}</p>
                                                            {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                                        </div>
                                                        {isSelected && restoredFromPreference && (
                                                            <span className="mt-1 inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">
                                                                Last used
                                                            </span>
                                                        )}
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {template.tags?.slice(0, 2).map((tag) => (
                                                                <span
                                                                    key={tag}
                                                                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                            {type === 'resume' && (
                                <div className="space-y-4">
                                    <label className="text-sm font-medium block">
                                        How would you like to provide your resume?
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        <Button
                                            type="button"
                                            variant={resumeInputMode === 'reference' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setResumeInputMode('reference')}
                                        >
                                            Reference resume
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={resumeInputMode === 'upload' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setResumeInputMode('upload')}
                                        >
                                            Upload PDF
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={resumeInputMode === 'paste' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setResumeInputMode('paste')}
                                        >
                                            Paste text
                                        </Button>
                                    </div>

                                    {resumeInputMode === 'reference' && (
                                        <div>
                                            {referenceResumes.length > 0 ? (
                                                <Select
                                                    value={selectedReferenceResumeId ?? undefined}
                                                    onValueChange={(v) => onSelectReferenceResume?.(v)}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select a resume" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {referenceResumes.map((r) => (
                                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">No resumes in your documents yet. Use upload or paste instead.</p>
                                            )}
                                        </div>
                                    )}

                                    {resumeInputMode === 'upload' && (
                                        <div className="space-y-2">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf,application/pdf"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                            {resumePdf ? (
                                                <div className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                                                    <FileText className="h-4 w-4 text-primary shrink-0" />
                                                    <span className="text-sm truncate flex-1">{resumePdfName || 'resume.pdf'}</span>
                                                    <Button type="button" variant="ghost" size="sm" onClick={clearPdf}>Remove</Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full gap-2"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <Upload className="h-4 w-4" />
                                                    Choose PDF file
                                                </Button>
                                            )}
                                            <p className="text-[10px] text-muted-foreground">We&apos;ll extract content with AI and tailor it to the job.</p>
                                        </div>
                                    )}

                                    {resumeInputMode === 'paste' && (
                                        <div className="space-y-2">
                                            <Textarea
                                                placeholder="Paste your resume text here..."
                                                value={resumeText}
                                                onChange={(e) => setResumeText(e.target.value)}
                                                className="min-h-[120px] text-sm resize-none"
                                                sanitize={false}
                                            />
                                            <Input
                                                placeholder="Optional: Add instructions (e.g. emphasize leadership, make it concise)"
                                                value={promptText}
                                                onChange={(e) => setPromptText(e.target.value)}
                                                className="text-sm"
                                                sanitize={false}
                                            />
                                            <p className="text-[10px] text-muted-foreground">Tip: Add instructions above to further customize the output.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t bg-muted/20">
                            <div className="p-5 flex items-center justify-between">
                                <Button
                                    disabled={isGenerating || (type === 'resume' && !hasResumeInput)}
                                    onClick={handleUseTemplate}
                                    className="gap-2"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    {isGenerating ? 'Generating...' : 'Generate'}
                                </Button>
                                <TooltipProvider>
                                    {(() => {
                                        const model = getModelForTemplateGeneration();
                                        if (!model) return null;
                                        return (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-xs font-medium">
                                                        <Avatar className="h-3.5 w-3.5">
                                                            {model.logoUrl ? (
                                                                <AvatarImage src={model.logoUrl} alt="" />
                                                            ) : null}
                                                            <AvatarFallback className="text-[9px]">
                                                                {model.provider.charAt(0)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        Powered by {model.name}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-xs">
                                                    <p className="font-medium">{model.name}</p>
                                                    <p className="text-muted-foreground text-xs">{model.provider}</p>
                                                    {model.description ? (
                                                        <p className="text-muted-foreground text-xs mt-1">{model.description}</p>
                                                    ) : null}
                                                </TooltipContent>
                                            </Tooltip>
                                        );
                                    })()}
                                </TooltipProvider>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
