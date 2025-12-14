'use client'

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, Save, Download, Loader2 } from "lucide-react";
import JkCW_ResumeContentEditor from "./jkChatWindow-ResumeContentEditor";

interface DynamicJSONEditorProps {
    resumeId: Id<"resumes">;
    onClose: () => void;
}

export default function JkCW_DynamicJSONEditor({ resumeId, onClose }: DynamicJSONEditorProps) {
    const resume = useQuery(api.documents.getResume, { resumeId });
    const updateResume = useMutation(api.documents.updateResume);
    
    const [isSaving, setIsSaving] = useState(false);
    const [initialFormContent, setInitialFormContent] = useState<any>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Ref to hold current form content
    const formContentRef = React.useRef<any>(null);

    // Get the template from the resume (default to "jake")
    const template = resume?.template || "jake";

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
            
            await updateResume({
                resumeId,
                content: contentToSave,
            });
            
            // Update initial content after save
            setInitialFormContent(contentToSave);
        } catch (error) {
            console.error("Failed to save resume:", error);
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

            // Determine which API route to call based on template
            const apiRoute = template === "jake" 
                ? "/api/resume/export/jake"
                : "/api/resume/export/jake"; // Default to jake for now

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
            
            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get("Content-Disposition");
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
            a.download = filenameMatch ? filenameMatch[1] : "resume.pdf";
            
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
        <div className="flex flex-col bg-background">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-xl font-semibold">Edit Resume Content</h2>
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

