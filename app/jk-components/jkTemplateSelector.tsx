'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, FileCheck, Sparkles, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type TemplateType = 'resume' | 'cover-letter'

export interface Template {
    id: string
    name: string
    description: string
    previewImage: string
    tags?: string[]
    features?: string[]
}

// Default templates with preview images
export const resumeTemplates: Template[] = [
    {
        id: 'jake',
        name: 'JobKompass Jake',
        description: 'A clean, ATS-optimized professional resume template. Perfect for tech roles with clear section hierarchy and modern typography.',
        previewImage: '/images/jobkompass_preview_resume_jake.png',
        tags: ['ATS-Friendly', 'Professional', 'Tech'],
        features: ['Optimized for ATS systems', 'Clean section hierarchy', 'Modern typography', 'Tech-focused layout'],
    },
]

export const coverLetterTemplates: Template[] = [
    {
        id: 'jake',
        name: 'JobKompass Jake',
        description: 'A matching cover letter template that pairs perfectly with the Jake resume. Clean formatting with professional structure.',
        previewImage: '/images/jobkompass_preview_cover_letter_jake.png',
        tags: ['Professional', 'Matching', 'Clean'],
        features: ['Matches Jake resume', 'Professional tone', 'Clear structure', 'ATS-compatible'],
    },
]

interface JkTemplateSelectorProps {
    isOpen: boolean
    onClose: () => void
    type: TemplateType
    onSelectTemplate: (templateId: string) => void
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

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

    // Clear selection when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedTemplateId(null)
        }
    }, [isOpen])

    const handleTemplateClick = (templateId: string) => {
        if (selectedTemplateId === templateId) {
            // Deselect if already selected
            setSelectedTemplateId(null)
        } else {
            // Select the template
            setSelectedTemplateId(templateId)
        }
    }

    const handleUseTemplate = () => {
        if (!selectedTemplateId) return;
        
        // For resumes: need selected template AND (no reference resumes OR reference resume selected)
        // For cover letters: only need selected template
        const canGenerate = type === 'resume' 
            ? (!isGenerating && (referenceResumes.length === 0 || selectedReferenceResumeId))
            : !isGenerating;
        
        if (canGenerate) {
            onSelectTemplate(selectedTemplateId)
        }
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
                        className="relative !no-scrollbar flex flex-col justify-between w-full max-w-4xl max-h-[70vh] h-full bg-background border border-border rounded-xl shadow-2xl"
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

                        {/* Templates Grid */}
                        <div className="p-5 w-full h-full overflow-x-auto !no-scrollbar">
                            <div className="flex gap-4 h-full w-max !no-scrollbar">
                                {templates.map((template) => {
                                    const isSelected = selectedTemplateId === template.id

                                    return (
                                        <motion.div
                                            key={template.id}
                                            layout
                                            onClick={() => handleTemplateClick(template.id)}
                                            className={`place-self-center !no-scrollbar flex h-full relative rounded-lg overflow-hidden cursor-pointer transition-all ${isSelected
                                                    ? 'ring-2 ring-primary/20'
                                                    : 'border-2 border-border hover:border-muted-foreground/40'
                                                }`}
                                        >
                                            <div className="flex h-full !no-scrollbar">
                                                
                                                {/* Preview Image and Info */}
                                                <div className="relative !no-scrollbar flex  h-full">
                                                    <img
                                                        src={template.previewImage}
                                                        alt={template.name}
                                                        style={{ objectFit: 'contain' }}
                                                        className=" h-full object-top z-1"
                                                    />

                                                    {/* Info - Always visible */}
                                                    <div className="p-2 bg-background w-full flex-shrink-0 flex flex-col z-10 absolute bottom-0 ">
                                                        <h3 className="font-medium text-sm mb-2 text-center">{template.name}</h3>
                                                        <div className="flex flex-wrap gap-1 justify-center">
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

                                                    {/* Selected Check */}
                                                    {isSelected && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="absolute !no-scrollbar top-2 left-2 p-1 bg-primary rounded-full shadow-lg"
                                                        >
                                                            <Check className="h-3 w-3 text-primary-foreground" />
                                                        </motion.div>
                                                    )}
                                                </div>

                                                {/* Expanded Details - Slides in from right */}
                                                <AnimatePresence>
                                                    {isSelected && (
                                                        <motion.div
                                                            initial={{ width: 0, opacity: 0 }}
                                                            animate={{ width: "400px", opacity: 1 }}
                                                            exit={{ width: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden border-l"
                                                        >
                                                            <div className="p-5 bg-muted/30 h-full flex flex-col min-w-[280px]">
                                                                <h3 className="font-semibold mb-2">{template.name}</h3>
                                                                <p className="text-sm text-muted-foreground mb-3">
                                                                    {template.description}
                                                                </p>
                                                                <ul className="space-y-1 mb-4 flex-1">
                                                                    {template.features?.map((feature, index) => (
                                                                        <li key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                            <div className="w-1 h-1 rounded-full bg-primary" />
                                                                            {feature}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                                {/* Reference resume selector (only for resumes) */}
                                                                {type === 'resume' && referenceResumes.length > 0 && (
                                                                    <div className="mb-4">
                                                                        <label className="text-xs text-muted-foreground block mb-2">
                                                                            Select reference resume (required)
                                                                        </label>
                                                                        <Select
                                                                            value={selectedReferenceResumeId ?? undefined}
                                                                            onValueChange={(value) => {
                                                                                onSelectReferenceResume?.(value)
                                                                            }}
                                                                        >
                                                                            <SelectTrigger 
                                                                                className="w-full"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <SelectValue placeholder="Select a resume" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {referenceResumes.map((resume) => (
                                                                                    <SelectItem 
                                                                                        key={resume.id} 
                                                                                        value={resume.id}
                                                                                    >
                                                                                        {resume.name}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                )}

                                                                <Button
                                                                    disabled={
                                                                        isGenerating ||
                                                                        (type === 'resume' && referenceResumes.length > 0 && !selectedReferenceResumeId)
                                                                    }
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleUseTemplate()
                                                                    }}
                                                                    className="gap-2 w-full"
                                                                >
                                                                    <Sparkles className="h-4 w-4" />
                                                                    {isGenerating ? 'Generating...' : 'Use Template'}
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                            </div>
                                        </motion.div>
                                    )
                                })}
                                {/* small spacing container */}
                                <div className="w-2 h-full"></div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t bg-muted/20">
                            <div className="p-5 flex items-center gap-2 text-muted-foreground">
                                <Sparkles className="h-3 w-3" />
                                <p className="text-xs">More templates coming soon</p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
