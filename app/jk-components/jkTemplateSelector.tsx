'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, FileCheck, Sparkles, Upload } from 'lucide-react'
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
    const [resumeInputMode, setResumeInputMode] = useState<ResumeInputMode>('reference')
    const [resumePdf, setResumePdf] = useState<string | null>(null)
    const [resumePdfName, setResumePdfName] = useState<string | null>(null)
    const [resumeText, setResumeText] = useState('')
    const [promptText, setPromptText] = useState('')
    const [descriptionExpanded, setDescriptionExpanded] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Auto-select the only available template and reset input state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            if (templates.length > 0) setSelectedTemplateId(templates[0].id)
        } else {
            setSelectedTemplateId(null)
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
