'use client'

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import React, { useEffect, useState, useRef } from "react";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { cn } from "@/lib/utils";
import { CalendarClock, FileText, Trash2, CheckCircle2, Circle, Upload, X, Tag, Edit2, Download, Briefcase, TrendingUp, TrendingDown, Ghost, Users, MoreVertical, Pencil, Settings, FileCheck, Loader2, Phone } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import JkGap from "../jkGap";
import JkConfirmDelete from "../jkConfirmDelete";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAppResumeTemplateOptions, COVER_LETTER_TEMPLATES, getDefaultResumeTemplateId, getDefaultCoverLetterTemplateId } from "@/lib/templates";
import JkCW_DynamicJSONEditor from "./jkChatWindow-DynamicJSONEditor";
import JkCW_CoverLetterContentEditor from "./jkChatWindow-CoverLetterContentEditor";
import { toast } from "@/lib/toast";
import { BlurFade } from "@/components/ui/blur-fade";

type DocumentTypeFilter = "all" | "resume" | "cover-letter";

function DocumentPreviewThumbnail({
    fileId,
    documentType,
    className,
}: {
    fileId?: Id<"_storage">;
    documentType: "resume" | "cover-letter";
    className?: string;
}) {
    const [isIframeLoaded, setIsIframeLoaded] = useState(false);
    const url = useQuery(
        api.documents.getFileUrl,
        fileId ? { fileId } : "skip"
    );

    // Reset loaded state when url changes
    useEffect(() => {
        if (url) setIsIframeLoaded(false);
    }, [url]);

    if (!fileId || !url) {
        return (
            <div className={cn("flex items-center justify-center w-full h-full bg-white", className)}>
                {documentType === "resume" ? (
                    <FileText className="h-12 w-12 text-muted-foreground/60" />
                ) : (
                    <FileCheck className="h-12 w-12 text-purple-500/60" />
                )}
            </div>
        );
    }
    return (
        <div className={cn("relative w-full h-full overflow-hidden bg-white", className)}>
            {!isIframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                </div>
            )}
            <iframe
                src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full border-0 translate-y-[-2%] rounded-lg pointer-events-none block"
                style={{
                    transform: "scale(1.2)",
                    transformOrigin: "center top",
                }}
                title="Document preview"
                onLoad={() => {
                    setTimeout(() => {
                        setIsIframeLoaded(true);
                    }, 2618);
                }}
            />
        </div>
    );
}

interface JkCW_DocumentsFormProps {
    typeFilter?: DocumentTypeFilter;
}

export default function JkCW_DocumentsForm({ typeFilter = "all" }: JkCW_DocumentsFormProps) {

    const {
        resumes,
        resumeStats,
        coverLetterStats,
        selectionMode,
        setSelectionMode,
        selectedResumeIds,
        toggleResumeSelection,
        selectAllResumes,
        clearResumeSelection,
        bulkDeleteResumes,
    } = useJobKompassResume();

    const {
        documents: allDocuments,
        resumeList,
        isLoading,
        selectedDocument,
        selectDocument,
        downloadFirstVersionResume,
    } = useJobKompassDocuments();
    
    const markResumeAsSeen = useMutation(api.documents.markResumeAsSeen);
    const markCoverLetterAsSeen = useMutation(api.documents.markCoverLetterAsSeen);
    
    // Helper function to mark document as seen
    const markDocumentAsSeen = async (id: string, documentType: "resume" | "cover-letter") => {
        try {
            if (documentType === "resume") {
                await markResumeAsSeen({ resumeId: id as Id<"resumes"> });
            } else {
                await markCoverLetterAsSeen({ coverLetterId: id as Id<"coverLetters"> });
            }
        } catch (error) {
            // Silently fail - don't interrupt user experience
            console.error('Failed to mark document as seen:', error);
        }
    };

    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [editingContentResumeId, setEditingContentResumeId] = useState<Id<"resumes"> | null>(null);
    const [editingContentCoverLetterId, setEditingContentCoverLetterId] = useState<Id<"coverLetters"> | null>(null);
    
    // File upload state
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [editingLabel, setEditingLabel] = useState("");
    const [editingTags, setEditingTags] = useState<string[]>([]);
    const [editingTemplate, setEditingTemplate] = useState("");
    const [newTagInput, setNewTagInput] = useState("");
    
    // Pre-upload dialog state
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [uploadName, setUploadName] = useState("");
    const [uploadLabel, setUploadLabel] = useState("");
    const [uploadTags, setUploadTags] = useState<string[]>([]);
    const [uploadTagInput, setUploadTagInput] = useState("");

    // Mutations
    const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
    const uploadResumeFile = useMutation(api.documents.uploadResumeFile);
    const saveGeneratedResumeWithFile = useMutation(api.documents.saveGeneratedResumeWithFile);
    const updateResumeFileMetadata = useMutation(api.documents.updateResumeFileMetadata);
    const updateCoverLetterMetadata = useMutation(api.documents.updateCoverLetterMetadata);
    const deleteCoverLetterMutation = useMutation(api.documents.deleteCoverLetter);

    // Track which document type is being edited for metadata
    const [editingDocType, setEditingDocType] = useState<"resume" | "cover-letter" | null>(null);

    useEffect(() => {
        if (!selectionMode) {
            setShowBulkDeleteConfirm(false);
            setIsBulkDeleting(false);
        }
    }, [selectionMode]);

    // Listen for custom event to open document edit panel from search
    useEffect(() => {
        const handleOpenDocumentEdit = (event: CustomEvent) => {
            const { documentId, documentType } = event.detail;
            if (documentType === "resume") {
                selectDocument(documentId, "resume");
                setEditingContentResumeId(documentId as Id<"resumes">);
            } else if (documentType === "cover-letter") {
                selectDocument(documentId, "cover-letter");
                setEditingContentCoverLetterId(documentId as Id<"coverLetters">);
            }
        };
        window.addEventListener('jk:openDocumentEdit', handleOpenDocumentEdit as EventListener);
        return () => {
            window.removeEventListener('jk:openDocumentEdit', handleOpenDocumentEdit as EventListener);
        };
    }, [selectDocument]);

    // Close edit resume panels when filter changes
    useEffect(() => {
        setEditingResumeId(null);
        setEditingContentResumeId(null);
    }, [typeFilter]);


    const handleEnterSelectionMode = () => {
        setSelectionMode(true);
        setConfirmingId(null);
    };

    const handleExitSelectionMode = () => {
        setSelectionMode(false);
        clearResumeSelection();
        setConfirmingId(null);
    };

    const handleConfirmBulkDeleteResumes = async () => {
        setIsBulkDeleting(true);
        try {
            await bulkDeleteResumes();
            setShowBulkDeleteConfirm(false);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleDocumentClick = (id: string, documentType: "resume" | "cover-letter") => {
        if (selectionMode) {
            // Selection mode only applies to resumes
            if (documentType === "resume") toggleResumeSelection(id);
            return;
        }
        selectDocument(id, documentType);
    };

    const handleDocumentDelete = async (documentId: string, documentType: "resume" | "cover-letter") => {
        setIsDeleting(documentId);
        try {
            if (documentType === "resume") {
                await bulkDeleteResumes([documentId]);
            } else {
                await deleteCoverLetterMutation({ coverLetterId: documentId as Id<"coverLetters"> });
            }
        } catch (error) {
            console.error("Error deleting document:", error);
        } finally {
            setIsDeleting(null);
        }
    };

    // File upload handler - PDF: AI extraction → structured content → generate PDF → save
    const handleFileUpload = async (file: File, name: string, label?: string, tags?: string[]) => {
        if (!file) {
            console.error("No file provided to upload");
            return;
        }

        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
            toast.error("Only PDF files are supported", {
                description: "We use AI to extract your resume content. PDF format is required.",
            });
            return;
        }

        setIsUploading(true);
        setUploadProgress(10);

        try {
            // 1. Read PDF as base64
            setUploadProgress(15);
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = reader.result as string;
                    resolve(dataUrl);
                };
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.readAsDataURL(file);
            });

            setUploadProgress(25);
            // 2. Generate PDF with AI (extract structured content)
            const generateResumePdfRes = await fetch("/api/documents/generate-resume-pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resumePdf: base64 }),
            });

            if (!generateResumePdfRes.ok) {
                const err = await generateResumePdfRes.json().catch(() => ({}));
                throw new Error(err.error || "Failed to generate resume PDF");
            }

            const { content } = await generateResumePdfRes.json();
            setUploadProgress(50);

            // 3. Generate PDF from extracted content via Jake template
            const exportRes = await fetch("/api/resume/export/jake", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });

            if (!exportRes.ok) {
                const err = await exportRes.json().catch(() => ({}));
                throw new Error(err.error || "Failed to generate PDF");
            }

            const pdfBlob = await exportRes.blob();
            setUploadProgress(70);

            // 4. Upload PDF to Convex storage
            const uploadUrl = await generateUploadUrl();
            const uploadRes = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": "application/pdf" },
                body: pdfBlob,
            });

            if (!uploadRes.ok) {
                throw new Error("Failed to upload PDF");
            }

            const { storageId } = await uploadRes.json();
            if (!storageId) throw new Error("No storage ID returned");

            setUploadProgress(90);

            // 5. Save resume with content and file
            const resumeName = name || file.name.replace(/\.[^/.]+$/, "");
            const pdfFileName = `${resumeName.replace(/[^a-zA-Z0-9-_]/g, "-")}-resume.pdf`;

            await saveGeneratedResumeWithFile({
                name: resumeName,
                fileId: storageId as Id<"_storage">,
                fileName: pdfFileName,
                fileSize: pdfBlob.size,
                content,
                template: "jake",
                label: label || undefined,
                tags: tags && tags.length > 0 ? tags : undefined,
            });

            setUploadProgress(100);
            toast.success("Resume uploaded and extracted", {
                description: "Your resume content has been extracted. You can now edit and download it.",
            });
            await new Promise((r) => setTimeout(r, 300));
        } catch (error) {
            console.error("Error uploading resume:", error);
            toast.error("Failed to upload resume", {
                description: error instanceof Error ? error.message : "Please try again.",
            });
            throw error;
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const defaultName = file.name.replace(/\.[^/.]+$/, "");
        setPendingFile(file);
        setUploadName(defaultName);
        setUploadLabel("");
        setUploadTags([]);
        setUploadTagInput("");
    };

    const handleAddUploadTag = () => {
        if (uploadTagInput.trim() && !uploadTags.includes(uploadTagInput.trim())) {
            setUploadTags([...uploadTags, uploadTagInput.trim()]);
            setUploadTagInput("");
        }
    };

    const handleRemoveUploadTag = (tagToRemove: string) => {
        setUploadTags(uploadTags.filter(tag => tag !== tagToRemove));
    };

    const handleCancelUpload = () => {
        setShowUploadDialog(false);
        setPendingFile(null);
        setUploadName("");
        setUploadLabel("");
        setUploadTags([]);
        setUploadTagInput("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleConfirmUpload = async () => {
        if (!pendingFile || !uploadName.trim()) {
            console.log("Upload prevented - missing file or name", { pendingFile: !!pendingFile, uploadName });
            return;
        }
        
        console.log("Starting upload...", { fileName: pendingFile.name, name: uploadName, label: uploadLabel, tags: uploadTags });
        
        try {
            // Don't close dialog yet - let upload complete first
            await handleFileUpload(pendingFile, uploadName, uploadLabel, uploadTags);
            
            console.log("Upload completed successfully");
            
            // Close dialog and reset state only after successful upload
            setShowUploadDialog(false);
            setPendingFile(null);
            setUploadName("");
            setUploadLabel("");
            setUploadTags([]);
            setUploadTagInput("");
        } catch (error) {
            // Error is already handled in handleFileUpload, but keep dialog open so user can retry
            console.error("Upload failed:", error);
        }
    };

    const handleEditMetadata = (doc: any, docType: "resume" | "cover-letter") => {
        setEditingResumeId(String(doc._id));
        setEditingDocType(docType);
        setEditingName(doc.name || "");
        setEditingLabel(doc.label || "");
        setEditingTags(doc.tags || []);
        setEditingTemplate(doc.template || (docType === "resume" ? getDefaultResumeTemplateId() : getDefaultCoverLetterTemplateId()));
        setNewTagInput("");
    };

    const handleSaveMetadata = async (docId: string, docType: "resume" | "cover-letter") => {
        try {
            if (docType === "resume") {
                await updateResumeFileMetadata({
                    resumeId: docId as Id<"resumes">,
                    name: editingName || undefined,
                    label: editingLabel || undefined,
                    tags: editingTags.length > 0 ? editingTags : undefined,
                    template: editingTemplate || undefined,
                });
            } else {
                await updateCoverLetterMetadata({
                    coverLetterId: docId as Id<"coverLetters">,
                    name: editingName || undefined,
                    label: editingLabel || undefined,
                    tags: editingTags.length > 0 ? editingTags : undefined,
                    template: editingTemplate || undefined,
                });
            }
            setEditingResumeId(null);
            setEditingDocType(null);
        } catch (error) {
            console.error("Error updating metadata:", error);
        }
    };

    const handleAddTag = () => {
        if (newTagInput.trim() && !editingTags.includes(newTagInput.trim())) {
            setEditingTags([...editingTags, newTagInput.trim()]);
            setNewTagInput("");
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setEditingTags(editingTags.filter(tag => tag !== tagToRemove));
    };

    const hasDocuments = allDocuments.length > 0;

    // Filter documents by type and search term
    const filteredDocuments = allDocuments.filter((doc: any) => {
        // Filter by type
        if (typeFilter !== "all" && doc.documentType !== typeFilter) {
            return false;
        }
        
        // Filter by search term
        const title = (doc?.name || doc?.jobTitle || "").toString().toLowerCase();
        const role = (doc?.targetRole || "").toString().toLowerCase();
        const label = (doc?.label || "").toString().toLowerCase();
        const tags = (doc?.tags || []).join(" ").toLowerCase();
        const search = searchTerm.toLowerCase().trim();
        if (!search) return true;
        return title.includes(search) || role.includes(search) || label.includes(search) || tags.includes(search);
    });


    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-9 w-full max-w-sm animate-pulse rounded-lg bg-muted/40" />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div
                            key={index}
                            className="flex h-48 animate-pulse flex-col gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4"
                        >
                            <div className="aspect-[3/4] w-full rounded-xl bg-muted/50" />
                            <div className="h-4 w-3/4 rounded bg-muted/50" />
                            <div className="h-3 w-1/2 rounded bg-muted/40" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!hasDocuments) {
        return (
            <div className="space-y-6">
                <section className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-8 py-14 text-center">
                    <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
                        <div className="inline-flex size-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-xl font-semibold">No documents yet</h2>
                            <p className="text-sm text-muted-foreground">
                                Upload a PDF resume and we&apos;ll extract your content into an editable format. Or generate resumes using the AI chat.
                            </p>
                        </div>
                        <Button
                            onClick={() => setShowUploadDialog(true)}
                            className="gap-2"
                            size="lg"
                        >
                            <Upload className="h-4 w-4" />
                            Upload PDF Resume
                        </Button>
                    </div>
                </section>

                {/* Pre-upload dialog for empty state */}
                <Dialog open={showUploadDialog} onOpenChange={(open) => {
                    if (!open) {
                        handleCancelUpload();
                    }
                }}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Upload Resume</DialogTitle>
                            <DialogDescription>
                                {pendingFile
                                    ? "We'll extract your resume content with AI and make it editable. Add a name and optional metadata."
                                    : "Choose a PDF resume to upload. We'll extract your content with AI and make it editable."}
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                            {/* Choose file button - when no file selected yet */}
                            {!pendingFile ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 py-10 px-4 transition-colors"
                                    >
                                        <Upload className="h-10 w-10 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">Choose PDF file</span>
                                        <span className="text-xs text-muted-foreground">Click to browse</span>
                                    </button>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={handleCancelUpload}>
                                            Cancel
                                        </Button>
                                    </DialogFooter>
                                </>
                            ) : null}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={handleFileInputChange}
                                className="hidden"
                                key="file-input-upload-dialog"
                            />

                            {/* File name display + form - when file selected */}
                            {pendingFile && (
                                <>
                                <div className="rounded-lg border border-border bg-muted/20 p-3">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{pendingFile.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({(pendingFile.size / 1024).toFixed(1)} KB)
                                        </span>
                                    </div>
                                </div>

                            {/* Name input */}
                            <div className="space-y-2">
                                <label htmlFor="upload-name-empty" className="text-sm font-medium text-foreground">
                                    Name <span className="text-muted-foreground">(required)</span>
                                </label>
                                <Input
                                    id="upload-name-empty"
                                    value={uploadName}
                                    onChange={(e) => setUploadName(e.target.value)}
                                    placeholder="e.g., Software Engineer Resume"
                                    className="h-9"
                                />
                            </div>

                            {/* Label input */}
                            <div className="space-y-2">
                                <label htmlFor="upload-label-empty" className="text-sm font-medium text-foreground">
                                    Label <span className="text-muted-foreground">(optional)</span>
                                </label>
                                <Input
                                    id="upload-label-empty"
                                    value={uploadLabel}
                                    onChange={(e) => setUploadLabel(e.target.value)}
                                    placeholder="e.g., Software Engineer, Marketing Manager"
                                    className="h-9"
                                />
                            </div>

                            {/* Tags input */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">
                                    Tags <span className="text-muted-foreground">(optional)</span>
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {uploadTags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveUploadTag(tag)}
                                                className="hover:text-blue-900"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        value={uploadTagInput}
                                        onChange={(e) => setUploadTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleAddUploadTag();
                                            }
                                        }}
                                        placeholder="Add a tag and press Enter"
                                        className="h-9 flex-1"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleAddUploadTag}
                                        disabled={!uploadTagInput.trim()}
                                        variant="outline"
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>

                        {/* Upload progress indicator */}
                        {isUploading && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 flex-1 rounded-full bg-muted">
                                        <div 
                                            className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">{uploadProgress}%</span>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">Uploading your resume...</p>
                            </div>
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancelUpload}
                                disabled={isUploading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirmUpload}
                                disabled={!uploadName.trim() || isUploading}
                            >
                                {isUploading ? "Uploading..." : "Upload Resume"}
                            </Button>
                        </DialogFooter>
                                </>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    return (
        <div className="space-y-6 py-2">
            {/* Header with stats and upload */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                    <div className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-foreground/70" />
                            <span>
                                <span className="font-semibold text-foreground">{allDocuments.length}</span> document{allDocuments.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    {!selectionMode && (
                        <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEnterSelectionMode}
                        >
                            Multi-select
                        </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setShowUploadDialog(true)}
                                className="gap-2"
                            >
                                <Upload className="h-4 w-4" />
                                Upload PDF Resume
                            </Button>
                        </>
                    )}
                </div>
                <Input
                    type="search"
                    placeholder="Search by name, label, or tags..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full min-w-0 max-w-sm"
                />
            </div>

            {isUploading && (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-muted">
                            <div 
                                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                    </div>
                </div>
            )}

            {selectionMode && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        {selectedResumeIds.length} selected
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllResumes(filteredDocuments.filter((doc: any) => doc.documentType === "resume").map((doc: any) => String(doc?._id ?? doc?.id)))}
                        disabled={filteredDocuments.filter((doc: any) => doc.documentType === "resume").length === 0 || selectedResumeIds.length === filteredDocuments.filter((doc: any) => doc.documentType === "resume").length}
                    >
                        Select All
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            if (selectedResumeIds.length === 0) return;
                            setShowBulkDeleteConfirm(true);
                        }}
                        disabled={selectedResumeIds.length === 0}
                    >
                        Delete Selected
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExitSelectionMode}
                    >
                        Cancel
                    </Button>
                </div>
            )}

            {selectionMode && showBulkDeleteConfirm && (
                <div className="max-w-xl">
                    <JkConfirmDelete
                        message={`Delete ${selectedResumeIds.length} selected resume${selectedResumeIds.length === 1 ? '' : 's'}?`}
                        onConfirm={handleConfirmBulkDeleteResumes}
                        onCancel={() => setShowBulkDeleteConfirm(false)}
                        isLoading={isBulkDeleting}
                    />
                </div>
            )}

            {/* Upload progress */}
            {/* Documents grid */}
            {filteredDocuments.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/10 px-6 py-12 text-center text-sm text-muted-foreground">
                    {searchTerm ? (
                        <>No documents match "{searchTerm}". Try a different keyword.</>
                    ) : (
                        <>No documents found. Upload your first document to get started.</>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
                    {filteredDocuments.map((doc: any, index: number) => {
                        const resume = doc;
                        const documentType = doc.documentType || "resume";
                        const resumeId = String(resume?._id ?? resume?.id ?? `resume-${index}`);
                        const isActive = Boolean(
                            selectedDocument &&
                            selectedDocument.type === documentType &&
                            String(selectedDocument.id) === String(resumeId)
                        );
                        const isSelectedForBulk = selectedResumeIds.includes(resumeId);
                        const title =
                            resume?.name ||
                            (resume?.jobTitle ? `${resume.jobTitle} Resume` : `Resume ${index + 1}`);
                        const roleFocus =
                            resume?.targetRole ||
                            resume?.jobTitle ||
                            "General purpose";
                        const updatedAt = resume?.updatedAt
                            ? new Date(resume.updatedAt).toLocaleDateString()
                            : "Recently created";

                        // Get stats for this document by title/name
                        const stats = documentType === "resume"
                            ? (resumeStats[title] || resumeStats[resume?.name] || null)
                            : (coverLetterStats[title] || coverLetterStats[resume?.name] || null);
                        const totalJobs = stats?.totalJobs || 0;
                        const offered = stats?.offered || 0;
                        const rejected = stats?.rejected || 0;
                        const ghosted = stats?.ghosted || 0;
                        const callback = stats?.callback ?? 0;
                        const interviewing = stats?.interviewing || 0;

                        // Check if document is new (never seen)
                        const isNew = !resume?.seenAt;

                        return (
                            <BlurFade key={resumeId} delay={0.0618 + index * 0.05} inView>
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => handleDocumentClick(resumeId, documentType)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        handleDocumentClick(resumeId, documentType);
                                    }
                                }}
                                className={cn(
                                    "group flex flex-col gap-3 sm:gap-4 rounded-xl border bg-card p-3 sm:p-4 text-left transition-all hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-0 overflow-hidden",
                                    selectionMode && isSelectedForBulk && "border-blue-500 ring-2 ring-blue-200",
                                    !selectionMode && isNew && "border-primary border-2"
                                )}
                            >
                                {/* Document preview thumbnail with job count badge and type indicator */}
                                <div className="relative flex h-24 sm:h-28 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30 overflow-hidden">
                                    <DocumentPreviewThumbnail
                                        fileId={resume?.fileId}
                                        documentType={documentType}
                                        className="absolute inset-0"
                                    />
                                    {/* Document type badge - top right */}
                                    <div className="absolute top-2 right-2 z-10">
                                        {documentType === "resume" ? (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
                                                <FileText className="h-3 w-3" />
                                                Resume
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
                                                <FileCheck className="h-3 w-3" />
                                                Cover Letter
                                            </span>
                                        )}
                                    </div>
                                    {/* Job count badge - top left */}
                                    {totalJobs > 0 && (
                                        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                                            <div className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
                                                <Briefcase className="h-3 w-3" />
                                                <span>{totalJobs} job{totalJobs !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
                                    <div className="flex min-w-0 items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <div>
                                                <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                                                {resume?.fileName && (
                                                    <p className="text-xs text-muted-foreground truncate">{resume.fileName}</p>
                                                )}
                                            </div>
                                            {resume?.label && (
                                                <p className="text-xs font-medium text-blue-600">{resume.label}</p>
                                            )}
                                            <div className="flex flex-wrap gap-1 items-center">
                                                {resume?.template && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 border border-purple-200">
                                                        {resume.template}
                                                    </span>
                                                )}
                                                {resume?.tags && resume.tags.length > 0 && (
                                                    <>
                                                        {resume.tags.slice(0, 3).map((tag: string, tagIdx: number) => (
                                                            <span
                                                                key={tagIdx}
                                                                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                                                            >
                                                                <Tag className="h-2.5 w-2.5" />
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {resume.tags.length > 3 && (
                                                            <span className="text-[10px] text-muted-foreground self-center">
                                                                +{resume.tags.length - 3}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            {/* Status badges - matching My Jobs status colors (only for resumes) */}
                                            {documentType === "resume" && (offered > 0 || rejected > 0 || ghosted > 0 || interviewing > 0 || callback > 0) && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {offered > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                                                            <TrendingUp className="h-2.5 w-2.5" />
                                                            {offered} offered
                                                        </span>
                                                    )}
                                                    {callback > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">
                                                            <Phone className="h-2.5 w-2.5" />
                                                            {callback} callback
                                                        </span>
                                                    )}
                                                    {interviewing > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                                                            <Users className="h-2.5 w-2.5" />
                                                            {interviewing} interviewing
                                                        </span>
                                                    )}
                                                    {rejected > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                                                            <TrendingDown className="h-2.5 w-2.5" />
                                                            {rejected} rejected
                                                        </span>
                                                    )}
                                                    {ghosted > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                                            <Ghost className="h-2.5 w-2.5" />
                                                            {ghosted} ghosted
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectionMode ? (
                                                documentType === "resume" ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            "h-8 w-8 text-muted-foreground hover:text-blue-600",
                                                            "transition-colors",
                                                            isSelectedForBulk && "text-blue-600"
                                                        )}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            toggleResumeSelection(resumeId);
                                                        }}
                                                    >
                                                        {isSelectedForBulk ? (
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        ) : (
                                                            <Circle className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                ) : null
                                            ) : (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                            }}
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                                                        {/* Edit content - for both resumes and cover letters */}
                                                        <DropdownMenuItem
                                                            onClick={async (event) => {
                                                                event.stopPropagation();
                                                                await markDocumentAsSeen(resumeId, documentType);
                                                                setSearchTerm(title);
                                                                if (documentType === "resume") {
                                                                    selectDocument(resumeId, "resume");
                                                                    setEditingContentResumeId(resume._id);
                                                                } else if (documentType === "cover-letter") {
                                                                    selectDocument(resumeId, "cover-letter");
                                                                    setEditingContentCoverLetterId(resume._id as Id<"coverLetters">);
                                                                }
                                                            }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            <span>Edit content</span>
                                                        </DropdownMenuItem>
                                                        {/* Edit labels & tags - works for both resumes and cover letters */}
                                                        <DropdownMenuItem
                                                            onClick={async (event) => {
                                                                event.stopPropagation();
                                                                await markDocumentAsSeen(resumeId, documentType);
                                                                handleEditMetadata(resume, documentType);
                                                            }}
                                                        >
                                                            <Settings className="h-4 w-4" />
                                                            <span>Edit labels & tags</span>
                                                        </DropdownMenuItem>
                                                        {/* Download - works for both if they have a fileId */}
                                                        {resume?.fileId && (
                                                            <DropdownMenuItem
                                                                onClick={async (event) => {
                                                                    event.stopPropagation();
                                                                    downloadFirstVersionResume(resume.fileId);
                                                                    void markDocumentAsSeen(resumeId, documentType);
                                                                }}
                                                            >
                                                                <Download className="h-4 w-4" />
                                                                <span>Download PDF</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            onClick={async (event) => {
                                                                await markDocumentAsSeen(resumeId, documentType);
                                                                event.stopPropagation();
                                                                setConfirmingId(resumeId);
                                                            }}
                                                            disabled={isDeleting === resumeId}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            <span>Delete</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    </div>
                                    {!selectionMode && confirmingId === resumeId && (
                                        <div
                                            className="mt-2"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            <JkConfirmDelete
                                                onConfirm={() => {
                                                    if (isDeleting === resumeId) return;
                                                    void handleDocumentDelete(resumeId, documentType).finally(() => {
                                                        setConfirmingId(null);
                                                    });
                                                }}
                                                onCancel={() => setConfirmingId(null)}
                                                isLoading={isDeleting === resumeId}
                                            />
                                        </div>
                                    )}
                                    {/* Metadata editor - works for both resumes and cover letters */}
                                    {!selectionMode && editingResumeId === resumeId && editingDocType === documentType && (
                                        <div
                                            className="mt-3 space-y-3 rounded-lg border border-border bg-muted/20 p-4"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-foreground">Name</label>
                                                <Input
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    placeholder="e.g., John Doe Resume (Jan 2026)"
                                                    className="h-8"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-foreground">Label</label>
                                                <Input
                                                    value={editingLabel}
                                                    onChange={(e) => setEditingLabel(e.target.value)}
                                                    placeholder="e.g., Software Engineer, Marketing"
                                                    className="h-8"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-foreground">Tags</label>
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {editingTags.map((tag, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
                                                        >
                                                            {tag}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveTag(tag)}
                                                                className="hover:text-blue-900"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={newTagInput}
                                                        onChange={(e) => setNewTagInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                handleAddTag();
                                                            }
                                                        }}
                                                        placeholder="Add a tag..."
                                                        className="h-8 flex-1"
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={handleAddTag}
                                                        disabled={!newTagInput.trim()}
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-foreground">Template</label>
                                                <Select
                                                    value={editingTemplate || undefined}
                                                    onValueChange={(v) => setEditingTemplate(v || "")}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Select template" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(documentType === "resume" ? getAppResumeTemplateOptions() : COVER_LETTER_TEMPLATES).map((t) => (
                                                            <SelectItem key={t.id} value={t.id}>
                                                                {t.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => void handleSaveMetadata(resumeId, documentType)}
                                                    className="flex-1"
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setEditingResumeId(null);
                                                        setEditingDocType(null);
                                                    }}
                                                    className="flex-1"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                                        <span className="flex items-center gap-1">
                                            <CalendarClock className="h-3 w-3" />
                                            {updatedAt}
                                            </span>
                                        <div className="flex items-center gap-1">
                                            {resume?.fileSize && (
                                                <span className="text-[10px]">
                                                    {(resume.fileSize / 1024).toFixed(1)} KB
                                            </span>
                                        )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </BlurFade>
                        );
                    })}
                </div>
            )}

            {/* Pre-upload dialog - always rendered, controlled by open prop */}
            <Dialog open={showUploadDialog} onOpenChange={(open) => {
                console.log("Dialog onOpenChange:", open, "current state:", showUploadDialog);
                if (!open) {
                    handleCancelUpload();
                }
            }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Upload Resume</DialogTitle>
                        <DialogDescription>
                            We&apos;ll extract your resume content with AI and make it editable. Add a name and optional metadata.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        {/* File name display */}
                        {pendingFile && (
                            <div className="rounded-lg border border-border bg-muted/20 p-3">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">{pendingFile.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        ({(pendingFile.size / 1024).toFixed(1)} KB)
                                    </span>
                                </div>
                        </div>
                        )}

                        {/* Name input */}
                        <div className="space-y-2">
                            <label htmlFor="upload-name" className="text-sm font-medium text-foreground">
                                Name <span className="text-muted-foreground">(required)</span>
                            </label>
                            <Input
                                id="upload-name"
                                value={uploadName}
                                onChange={(e) => setUploadName(e.target.value)}
                                placeholder="e.g., Software Engineer Resume"
                                className="h-9"
                            />
                        </div>

                        {/* Label input */}
                        <div className="space-y-2">
                            <label htmlFor="upload-label" className="text-sm font-medium text-foreground">
                                Label <span className="text-muted-foreground">(optional)</span>
                            </label>
                            <Input
                                id="upload-label"
                                value={uploadLabel}
                                onChange={(e) => setUploadLabel(e.target.value)}
                                placeholder="e.g., Software Engineer, Marketing Manager"
                                className="h-9"
                            />
                            <p className="text-xs text-muted-foreground">
                                A short label to categorize this resume
                            </p>
                        </div>

                        {/* Tags input */}
                        <div className="space-y-2">
                            <label htmlFor="upload-tags" className="text-sm font-medium text-foreground">
                                Tags <span className="text-muted-foreground">(optional)</span>
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {uploadTags.map((tag, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveUploadTag(tag)}
                                            className="hover:text-blue-900"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    id="upload-tags"
                                    value={uploadTagInput}
                                    onChange={(e) => setUploadTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddUploadTag();
                                        }
                                    }}
                                    placeholder="Add a tag and press Enter"
                                    className="h-9 flex-1"
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAddUploadTag}
                                    disabled={!uploadTagInput.trim()}
                                    variant="outline"
                                >
                                    Add
                                </Button>
                                        </div>
                            </div>
                        </div>

                    {/* Upload progress indicator */}
                    {isUploading && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 rounded-full bg-muted">
                                    <div 
                                        className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                                <span className="text-sm text-muted-foreground whitespace-nowrap">{uploadProgress}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">Uploading your resume...</p>
                    </div>
                )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelUpload}
                            disabled={isUploading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirmUpload}
                            disabled={!uploadName.trim() || isUploading}
                        >
                            {isUploading ? "Uploading..." : "Upload Resume"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Content Editor - Inline */}
            {editingContentResumeId && (
                <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
                    <JkCW_DynamicJSONEditor
                        resumeId={editingContentResumeId}
                        onClose={() => setEditingContentResumeId(null)}
                    />
                </div>
            )}

            {editingContentCoverLetterId && (
                <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
                    <JkCW_CoverLetterContentEditor
                        coverLetterId={editingContentCoverLetterId}
                        onClose={() => setEditingContentCoverLetterId(null)}
                    />
                </div>
            )}

            {/* Upload PDF modal - shared between empty state and documents view */}
            <Dialog open={showUploadDialog} onOpenChange={(open) => {
                if (!open) handleCancelUpload();
            }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Upload Resume</DialogTitle>
                        <DialogDescription>
                            {pendingFile
                                ? "We'll extract your resume content with AI and make it editable. Add a name and optional metadata."
                                : "Choose a PDF resume to upload. We'll extract your content with AI and make it editable."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        {!pendingFile ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 py-10 px-4 transition-colors"
                                >
                                    <Upload className="h-10 w-10 text-muted-foreground" />
                                    <span className="text-sm font-medium text-foreground">Choose PDF file</span>
                                    <span className="text-xs text-muted-foreground">Click to browse</span>
                                </button>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={handleCancelUpload}>
                                        Cancel
                                    </Button>
                                </DialogFooter>
                            </>
                        ) : null}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handleFileInputChange}
                            className="hidden"
                            key="file-input-upload-dialog-main"
                        />

                        {pendingFile && (
                            <>
                                <div className="rounded-lg border border-border bg-muted/20 p-3">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{pendingFile.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({(pendingFile.size / 1024).toFixed(1)} KB)
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="upload-name-main" className="text-sm font-medium text-foreground">
                                        Name <span className="text-muted-foreground">(required)</span>
                                    </label>
                                    <Input
                                        id="upload-name-main"
                                        value={uploadName}
                                        onChange={(e) => setUploadName(e.target.value)}
                                        placeholder="e.g., Software Engineer Resume"
                                        className="h-9"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="upload-label-main" className="text-sm font-medium text-foreground">
                                        Label <span className="text-muted-foreground">(optional)</span>
                                    </label>
                                    <Input
                                        id="upload-label-main"
                                        value={uploadLabel}
                                        onChange={(e) => setUploadLabel(e.target.value)}
                                        placeholder="e.g., Software Engineer, Marketing Manager"
                                        className="h-9"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">
                                        Tags <span className="text-muted-foreground">(optional)</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {uploadTags.map((tag, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveUploadTag(tag)}
                                                    className="hover:text-blue-900"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={uploadTagInput}
                                            onChange={(e) => setUploadTagInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddUploadTag();
                                                }
                                            }}
                                            placeholder="Add a tag and press Enter"
                                            className="h-9 flex-1"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddUploadTag}
                                            disabled={!uploadTagInput.trim()}
                                            variant="outline"
                                        >
                                            Add
                                        </Button>
                                    </div>
                                </div>

                                {isUploading && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 flex-1 rounded-full bg-muted">
                                                <div 
                                                    className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">{uploadProgress}%</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center">Uploading your resume...</p>
                                    </div>
                                )}

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCancelUpload}
                                        disabled={isUploading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleConfirmUpload}
                                        disabled={!uploadName.trim() || isUploading}
                                    >
                                        {isUploading ? "Uploading..." : "Upload Resume"}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <JkGap size="small" />
        </div>
    );
}