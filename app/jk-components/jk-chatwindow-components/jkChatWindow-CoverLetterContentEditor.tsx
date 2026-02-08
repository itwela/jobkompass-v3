'use client'

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getCoverLetterExportRoute, getDefaultCoverLetterTemplateId } from "@/lib/templates";
import { X, Plus, Trash2, Save, ChevronDown, ChevronUp, Search, Download, Loader2, CheckCircle } from "lucide-react";
import { Reorder } from "framer-motion";
import JkReorderableItem from "./jkReorderableItem";
import { cn } from "@/lib/utils";
import JkSlideModalGlass from "../jkSlideModalGlass";

// Convert literal \n sequences (from AI-generated text) into real newlines for textarea display
function cleanNewlines(text: string): string {
    if (!text) return text;
    return text.replace(/\\n/g, '\n');
}

type CoverLetterContent = {
    personalInfo: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        location?: string;
    };
    jobInfo: {
        company: string;
        position: string;
        hiringManagerName?: string;
        companyAddress?: string;
    };
    letterContent: {
        openingParagraph: string;
        bodyParagraphs: string[];
        closingParagraph: string;
    };
};

const emptyContent: CoverLetterContent = {
    personalInfo: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        location: "",
    },
    jobInfo: {
        company: "",
        position: "",
        hiringManagerName: "",
        companyAddress: "",
    },
    letterContent: {
        openingParagraph: "",
        bodyParagraphs: [],
        closingParagraph: "",
    },
};

interface CoverLetterContentEditorProps {
    coverLetterId: Id<"coverLetters">;
    onClose: () => void;
    initialContent?: any;
    contentRef?: React.MutableRefObject<any>;
}

export default function JkCW_CoverLetterContentEditor({ 
    coverLetterId, 
    onClose, 
    initialContent,
    contentRef
}: CoverLetterContentEditorProps) {
    const coverLetter = useQuery(api.documents.getCoverLetter, { coverLetterId });
    const template = coverLetter?.template || getDefaultCoverLetterTemplateId();
    const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
    const replaceCoverLetterFile = useMutation(api.documents.replaceCoverLetterFile);
    
    const [content, setContent] = useState<CoverLetterContent>(emptyContent);
    const [isSaving, setIsSaving] = useState(false);
    const [initialFormContent, setInitialFormContent] = useState<any>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["personalInfo"]));
    const [hasChanges, setHasChanges] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Ref to hold current form content
    const formContentRef = React.useRef<any>(null);

    // Track if we've loaded initial content
    const hasLoadedRef = React.useRef(false);

    // Initialize from cover letter
    useEffect(() => {
        if (coverLetter?.content) {
            const coverLetterContent = coverLetter.content as any;
            
            // Handle both old and new content formats
            if (coverLetterContent.personalInfo) {
                const formattedContent = {
                    personalInfo: {
                        firstName: coverLetterContent.personalInfo.firstName || "",
                        lastName: coverLetterContent.personalInfo.lastName || "",
                        email: coverLetterContent.personalInfo.email || "",
                        phone: coverLetterContent.personalInfo.phone || "",
                        location: coverLetterContent.personalInfo.location || "",
                    },
                    jobInfo: {
                        company: coverLetterContent.jobInfo?.company || "",
                        position: coverLetterContent.jobInfo?.position || "",
                        hiringManagerName: coverLetterContent.jobInfo?.hiringManagerName || "",
                        companyAddress: coverLetterContent.jobInfo?.companyAddress || "",
                    },
                    letterContent: {
                        openingParagraph: cleanNewlines(coverLetterContent.letterContent?.openingParagraph || ""),
                        bodyParagraphs: (coverLetterContent.letterContent?.bodyParagraphs || []).map((p: string) => cleanNewlines(p)),
                        closingParagraph: cleanNewlines(coverLetterContent.letterContent?.closingParagraph || ""),
                    },
                };
                setContent(formattedContent);
                setInitialFormContent(formattedContent);
            }
            hasLoadedRef.current = true;
        }
    }, [coverLetter]);

    // Sync content to refs
    useEffect(() => {
        formContentRef.current = content;
        if (contentRef) {
            contentRef.current = content;
        }
    }, [content, contentRef]);

    // Sync initial content if provided
    useEffect(() => {
        if (initialContent && !hasLoadedRef.current) {
            const cleaned = {
                ...initialContent,
                letterContent: {
                    openingParagraph: cleanNewlines(initialContent.letterContent.openingParagraph),
                    bodyParagraphs: initialContent.letterContent.bodyParagraphs.map((p: string) => cleanNewlines(p)),
                    closingParagraph: cleanNewlines(initialContent.letterContent.closingParagraph),
                },
            };
            setContent(cleaned);
            setInitialFormContent(cleaned);
            hasLoadedRef.current = true;
        }
    }, [initialContent]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    const updatePersonalInfo = (field: keyof CoverLetterContent['personalInfo'], value: string) => {
        setContent(prev => ({
            ...prev,
            personalInfo: { ...prev.personalInfo, [field]: value }
        }));
        setHasChanges(true);
    };

    const updateJobInfo = (field: keyof CoverLetterContent['jobInfo'], value: string) => {
        setContent(prev => ({
            ...prev,
            jobInfo: { ...prev.jobInfo, [field]: value }
        }));
        setHasChanges(true);
    };

    const updateOpeningParagraph = (value: string) => {
        setContent(prev => ({
            ...prev,
            letterContent: { ...prev.letterContent, openingParagraph: value }
        }));
        setHasChanges(true);
    };

    const updateClosingParagraph = (value: string) => {
        setContent(prev => ({
            ...prev,
            letterContent: { ...prev.letterContent, closingParagraph: value }
        }));
        setHasChanges(true);
    };

    const addBodyParagraph = () => {
        setContent(prev => ({
            ...prev,
            letterContent: {
                ...prev.letterContent,
                bodyParagraphs: [...prev.letterContent.bodyParagraphs, ""]
            }
        }));
        setHasChanges(true);
    };

    const updateBodyParagraph = (index: number, value: string) => {
        setContent(prev => ({
            ...prev,
            letterContent: {
                ...prev.letterContent,
                bodyParagraphs: prev.letterContent.bodyParagraphs.map((para, i) => 
                    i === index ? value : para
                )
            }
        }));
        setHasChanges(true);
    };

    const removeBodyParagraph = (index: number) => {
        setContent(prev => ({
            ...prev,
            letterContent: {
                ...prev.letterContent,
                bodyParagraphs: prev.letterContent.bodyParagraphs.filter((_, i) => i !== index)
            }
        }));
        setHasChanges(true);
    };

    const reorderBodyParagraphs = (newOrder: string[]) => {
        setContent(prev => ({
            ...prev,
            letterContent: {
                ...prev.letterContent,
                bodyParagraphs: newOrder,
            }
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Use current form content from ref
            const contentToSave = formContentRef.current || initialFormContent;
            
            if (!contentToSave) {
                console.error("No content to save");
                setIsSaving(false);
                return;
            }
            
            // Step 1: Generate PDF from the edited content
            const apiRoute = getCoverLetterExportRoute(template);
            const pdfResponse = await fetch(apiRoute, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ content: contentToSave }),
            });

            if (!pdfResponse.ok) {
                const errorData = await pdfResponse.json();
                console.error("PDF generation failed:", errorData);
                alert(`Failed to generate PDF: ${errorData.error || "Unknown error"}`);
                setIsSaving(false);
                return;
            }

            // Step 2: Get the PDF blob
            const pdfBlob = await pdfResponse.blob();
            
            // Step 3: Upload to Convex storage
            const uploadUrl = await generateUploadUrl();
            
            const uploadResponse = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/pdf",
                },
                body: pdfBlob,
            });

            if (!uploadResponse.ok) {
                throw new Error("Failed to upload PDF to storage");
            }

            const { storageId } = await uploadResponse.json();
            
            // Step 4: Replace the old file and update content
            const firstName = contentToSave.personalInfo?.firstName || "";
            const lastName = contentToSave.personalInfo?.lastName || "";
            const company = contentToSave.jobInfo?.company || "";
            const fileName = `coverletter-${firstName}-${lastName}${company ? `-${company}` : ''}.pdf`.replace(/\s+/g, '-');
            
            await replaceCoverLetterFile({
                coverLetterId,
                newFileId: storageId as Id<"_storage">,
                fileName,
                fileSize: pdfBlob.size,
                content: contentToSave,
            });
            
            // Update initial content after save
            setInitialFormContent(contentToSave);
            setHasChanges(false);
            
            // Show success notification
            setShowSaveSuccess(true);
            
            // Auto-hide success after 4 seconds
            setTimeout(() => {
                setShowSaveSuccess(false);
            }, 4000);
        } catch (error) {
            console.error("Failed to save cover letter:", error);
            alert("Failed to save cover letter. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            // Get current form content
            const contentToDownload = formContentRef.current || initialFormContent;

            if (!contentToDownload) {
                console.error("No content to download");
                setIsDownloading(false);
                return;
            }

            const apiRoute = getCoverLetterExportRoute(template);
            const response = await fetch(apiRoute, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ content: contentToDownload }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Download failed:", errorData);
                alert(`Failed to generate PDF: ${errorData.error || "Unknown error"}`);
                setIsDownloading(false);
                return;
            }

            // Get the PDF blob and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            
            // Generate filename using cover letter name or just name and date
            const firstName = contentToDownload.personalInfo?.firstName || "";
            const lastName = contentToDownload.personalInfo?.lastName || "";
            const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
            
            // Use the cover letter name if available, otherwise just use name and date
            const coverLetterName = coverLetter?.name || "";
            const downloadName = coverLetterName
                ? `${coverLetterName} (${dateStr}).pdf`.trim()
                : `${firstName} ${lastName} Cover Letter (${dateStr}).pdf`.trim();
            a.download = downloadName || "cover-letter.pdf";
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download error:", error);
            alert("Failed to download cover letter. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    const filterFields = (fields: any[], query: string) => {
        if (!query) return fields;
        const lowerQuery = query.toLowerCase();
        return fields.filter(field => 
            Object.values(field).some(val => 
                String(val).toLowerCase().includes(lowerQuery)
            )
        );
    };

    return (
        <div className="flex flex-col bg-background relative">
            {/* Success Notification */}
            <JkSlideModalGlass
                isOpen={showSaveSuccess}
                title="Cover Letter Saved"
                description={`Your cover letter "${coverLetter?.name || 'Cover Letter'}" has been updated with the new PDF.`}
                icon={CheckCircle}
                variant="green"
                canMinimize={false}
                position="top"
            />
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b gap-4">
                <h2 className="text-xl font-semibold truncate min-w-0">
                    Editing {coverLetter?.name || "Cover Letter"}
                </h2>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                    >
                        {isDownloading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                Download This Version
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        size="sm"
                        variant="outline"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content Editor */}
            <div className="flex-1 overflow-hidden">
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Search Bar */}
                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search cover letter content..."
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {/* Content Editor */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Personal Info Section */}
                        <div className="border rounded-lg">
                            <button
                                onClick={() => toggleSection("personalInfo")}
                                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                            >
                                <h3 className="font-semibold">Personal Information</h3>
                                {expandedSections.has("personalInfo") ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </button>
                            {expandedSections.has("personalInfo") && (
                                <div className="p-4 space-y-4 border-t">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">First Name</label>
                                            <Input
                                                value={content.personalInfo.firstName}
                                                onChange={(e) => updatePersonalInfo("firstName", e.target.value)}
                                                placeholder="John"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Last Name</label>
                                            <Input
                                                value={content.personalInfo.lastName}
                                                onChange={(e) => updatePersonalInfo("lastName", e.target.value)}
                                                placeholder="Doe"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Email</label>
                                        <Input
                                            type="email"
                                            value={content.personalInfo.email}
                                            onChange={(e) => updatePersonalInfo("email", e.target.value)}
                                            placeholder="john.doe@example.com"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Phone</label>
                                            <Input
                                                value={content.personalInfo.phone || ""}
                                                onChange={(e) => updatePersonalInfo("phone", e.target.value)}
                                                placeholder="(555) 123-4567"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Location</label>
                                            <Input
                                                value={content.personalInfo.location || ""}
                                                onChange={(e) => updatePersonalInfo("location", e.target.value)}
                                                placeholder="City, State"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Job Info Section */}
                        <div className="border rounded-lg">
                            <button
                                onClick={() => toggleSection("jobInfo")}
                                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                            >
                                <h3 className="font-semibold">Job Information</h3>
                                {expandedSections.has("jobInfo") ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </button>
                            {expandedSections.has("jobInfo") && (
                                <div className="p-4 space-y-4 border-t">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Company</label>
                                            <Input
                                                value={content.jobInfo.company}
                                                onChange={(e) => updateJobInfo("company", e.target.value)}
                                                placeholder="Company Name"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Position</label>
                                            <Input
                                                value={content.jobInfo.position}
                                                onChange={(e) => updateJobInfo("position", e.target.value)}
                                                placeholder="Job Title"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Hiring Manager Name</label>
                                        <Input
                                            value={content.jobInfo.hiringManagerName || ""}
                                            onChange={(e) => updateJobInfo("hiringManagerName", e.target.value)}
                                            placeholder="Hiring Manager (optional)"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Company Address</label>
                                        <Textarea
                                            value={content.jobInfo.companyAddress || ""}
                                            onChange={(e) => updateJobInfo("companyAddress", e.target.value)}
                                            placeholder="Company Address (optional)"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Letter Content Section */}
                        <div className="border rounded-lg">
                            <button
                                onClick={() => toggleSection("letterContent")}
                                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                            >
                                <h3 className="font-semibold">Letter Content</h3>
                                {expandedSections.has("letterContent") ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </button>
                            {expandedSections.has("letterContent") && (
                                <div className="p-4 space-y-4 border-t">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Opening Paragraph</label>
                                        <Textarea
                                            value={content.letterContent.openingParagraph}
                                            onChange={(e) => updateOpeningParagraph(e.target.value)}
                                            placeholder="Dear [Hiring Manager], I am writing to express my interest in..."
                                            rows={4}
                                        />
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium">Body Paragraphs</label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addBodyParagraph}
                                                className="gap-2"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Add Paragraph
                                            </Button>
                                        </div>
                                        <Reorder.Group axis="y" values={content.letterContent.bodyParagraphs} onReorder={reorderBodyParagraphs} as="div" className="space-y-3">
                                        {content.letterContent.bodyParagraphs.map((para, index) => (
                                            <JkReorderableItem key={`para-${index}`} value={para} className="p-3 border rounded-lg bg-muted/20">
                                                <div className="flex items-start gap-2">
                                                    <Textarea
                                                        value={para}
                                                        onChange={(e) => updateBodyParagraph(index, e.target.value)}
                                                        placeholder={`Body paragraph ${index + 1}...`}
                                                        rows={4}
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeBodyParagraph(index)}
                                                        className="mt-0"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </JkReorderableItem>
                                        ))}
                                        </Reorder.Group>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Closing Paragraph</label>
                                        <Textarea
                                            value={content.letterContent.closingParagraph}
                                            onChange={(e) => updateClosingParagraph(e.target.value)}
                                            placeholder="Thank you for your consideration. I look forward to hearing from you..."
                                            rows={4}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

