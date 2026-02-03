'use client'

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getResumeExportRoute, getDefaultResumeTemplateId } from "@/lib/templates";
import { X, Save, Download, Loader2, CheckCircle } from "lucide-react";
import JkCW_ResumeContentEditor from "./jkChatWindow-ResumeContentEditor";
import JkSlideModalGlass from "../jkSlideModalGlass";

interface DynamicJSONEditorProps {
    resumeId: Id<"resumes">;
    onClose: () => void;
}

export default function JkCW_DynamicJSONEditor({ resumeId, onClose }: DynamicJSONEditorProps) {
    const resume = useQuery(api.documents.getResume, { resumeId });
    const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
    const replaceResumeFile = useMutation(api.documents.replaceResumeFile);
    
    const [isSaving, setIsSaving] = useState(false);
    const [initialFormContent, setInitialFormContent] = useState<any>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    
    // Ref to hold current form content
    const formContentRef = React.useRef<any>(null);

    // Get the template from the resume (default from centralized constants)
    const template = resume?.template || getDefaultResumeTemplateId();

    // Initialize from resume
    React.useEffect(() => {
        if (resume?.content) {
            setInitialFormContent(resume.content);
        }
    }, [resume]);

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
            const apiRoute = getResumeExportRoute(template);
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
            const fileName = `resume-${firstName}-${lastName}.pdf`.replace(/\s+/g, '-');
            
            await replaceResumeFile({
                resumeId,
                newFileId: storageId as Id<"_storage">,
                fileName,
                fileSize: pdfBlob.size,
                content: contentToSave,
            });
            
            // Update initial content after save
            setInitialFormContent(contentToSave);
            
            // Show success notification
            setShowSaveSuccess(true);
            
            // Auto-hide success after 4 seconds
            setTimeout(() => {
                setShowSaveSuccess(false);
            }, 4000);
        } catch (error) {
            console.error("Failed to save resume:", error);
            alert("Failed to save resume. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            // Get current form content
            const content = formContentRef.current || initialFormContent;

            if (!content) {
                console.error("No content to download");
                setIsDownloading(false);
                return;
            }

            // Use centralized template -> export route mapping
            const apiRoute = getResumeExportRoute(template);

            const response = await fetch(apiRoute, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ content }),
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
            
            // Generate filename using resume name or just name and date
            const firstName = content.personalInfo?.firstName || "";
            const lastName = content.personalInfo?.lastName || "";
            const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
            
            // Use the resume name if available, otherwise just use name and date
            const resumeName = resume?.name || "";
            const downloadName = resumeName
                ? `${resumeName} (${dateStr}).pdf`.trim()
                : `${firstName} ${lastName} Resume (${dateStr}).pdf`.trim();
            a.download = downloadName || "resume.pdf";
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download error:", error);
            alert("Failed to download resume. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex flex-col bg-background relative">
            {/* Success Notification */}
            <JkSlideModalGlass
                isOpen={showSaveSuccess}
                title="Resume Saved"
                description={`Your resume "${resume?.name || 'Resume'}" has been updated with the new PDF.`}
                icon={CheckCircle}
                variant="green"
                canMinimize={false}
                position="top"
            />
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b gap-4">
                <h2 className="text-xl font-semibold truncate min-w-0">
                    Editing {resume?.name || "Resume"}
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

            {/* Content - Form mode only */}
            <div className="flex-1 overflow-hidden">
                <JkCW_ResumeContentEditor 
                    resumeId={resumeId} 
                    onClose={onClose}
                    initialContent={initialFormContent}
                    contentRef={formContentRef}
                />
            </div>
        </div>
    );
}

