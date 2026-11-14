'use client'

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import React, { useEffect, useState, useRef } from "react";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { cn } from "@/lib/utils";
import { CalendarClock, FileText, Trash2, CheckCircle2, Circle, Upload, X, Tag, Edit2, Download, Briefcase, TrendingUp, TrendingDown, Ghost, Users, MoreVertical, Pencil, Settings, FileCheck, Loader2, Phone, Copy, Star, FolderPlus, Link2, Link2Off, Pin } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import JkGap from "../jkGap";
import JkConfirmDelete from "../jkConfirmDelete";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JkDefaultTemplateProbe } from "../jkDefaultTemplate";
import { getAppResumeTemplateOptions, COVER_LETTER_TEMPLATES, getDefaultResumeTemplateId, getDefaultCoverLetterTemplateId, getResumeTemplateById, resolveResumeTemplateId } from "@/lib/templates";
import JkCW_DynamicJSONEditor from "./jkChatWindow-DynamicJSONEditor";
import JkCW_CoverLetterContentEditor from "./jkChatWindow-CoverLetterContentEditor";
import { toast } from "@/lib/toast";
import { buildResumeContentFromPastedText } from "@/lib/resume/contentFromPastedText";
import { resolveBaseResumeId, sortDocuments } from "@/lib/documents/sortDocuments";
import JkDocumentFolderCard, { FOLDER_ACCENTS, type JkDraggedDocument, type JkFolder } from "../jk-documents/jkDocumentFolderCard";
import JkDocumentCard, { JkDocMenuTrigger } from "../jk-documents/jkDocumentCard";
import JkDocFilterTabs, { type JkDocFilter } from "../jk-documents/jkDocFilterTabs";
import JkAppPageHeader from "../jk-app/jkAppPageHeader";
import JkSectionLabel from "../jk-app/jkSectionLabel";
import JkDocPreview from "../jkDocPreview";
import { JkEditorTopBar } from "../jk-documents/jkEditorTopBar";
import { useJobs } from "@/providers/jkJobsProvider";
import { editedAgo, linkedCompanyFor, shortDate, templateShortName } from "@/lib/documents/documentMeta";
import JkFolderBreadcrumb from "../jk-documents/jkFolderBreadcrumb";
import JkMoveToFolderMenu from "../jk-documents/jkMoveToFolderMenu";
import { markResumeCreateSource } from "@/lib/analytics/client";
import { rateLimitMessageFromResponse } from "@/lib/rateLimit/message";

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
            <div className={cn("flex items-center justify-center w-full h-full bg-card", className)}>
                {documentType === "resume" ? (
                    <FileText className="h-12 w-12 text-muted-foreground/60" />
                ) : (
                    <FileCheck className="h-12 w-12 text-bar-1/60" />
                )}
            </div>
        );
    }
    return (
        <div className={cn("relative w-full h-full overflow-hidden bg-card", className)}>
            {!isIframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
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
    initialFilter?: JkDocFilter;
}

export default function JkCW_DocumentsForm({ initialFilter = "all" }: JkCW_DocumentsFormProps) {
    const [typeFilter, setTypeFilter] = useState<JkDocFilter>(initialFilter);
    // Default template from Settings (users.defaultTemplate); falls back to the app default.
    const [userDefaultTemplate, setUserDefaultTemplate] = useState<string | null>(null);
    const defaultResumeTemplateId = () => userDefaultTemplate || getDefaultResumeTemplateId();
    const { allJobs } = useJobs();

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
    const setBaseResume = useMutation(api.documents.setBaseResume);
    const toggleFavorite = useMutation(api.documents.toggleFavorite);
    const [settingBaseId, setSettingBaseId] = useState<string | null>(null);

    const handleSetBaseResume = async (resumeId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        setSettingBaseId(resumeId);
        try {
            await setBaseResume({ resumeId: resumeId as Id<"resumes"> });
            toast.success("Base resume updated — job leads will tailor from this one.");
        } catch {
            toast.error("Could not set base resume. Please try again.");
        } finally {
            setSettingBaseId(null);
        }
    };
    
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
    /** Shown under the progress bar so long AI steps do not look frozen at 25%. */
    const [uploadStatusLabel, setUploadStatusLabel] = useState("");
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
    /** Pasted resume text — skips PDF extraction (scanned PDFs). */
    const [pastedResumeText, setPastedResumeText] = useState("");

    const MIN_PASTE_RESUME_CHARS = 20;

    // Mutations
    const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
    const uploadResumeFile = useMutation(api.documents.uploadResumeFile);
    const saveGeneratedResumeWithFile = useMutation(api.documents.saveGeneratedResumeWithFile);
    const updateResumeFileMetadata = useMutation(api.documents.updateResumeFileMetadata);
    const updateCoverLetterMetadata = useMutation(api.documents.updateCoverLetterMetadata);
    const deleteCoverLetterMutation = useMutation(api.documents.deleteCoverLetter);
    const duplicateResumeMutation = useMutation(api.documents.duplicateResume);
    const shareResumeMutation = useMutation(api.resumeShares.shareResume);
    const duplicateCoverLetterMutation = useMutation(api.documents.duplicateCoverLetter);

    // Track which document type is being edited for metadata
    const [editingDocType, setEditingDocType] = useState<"resume" | "cover-letter" | null>(null);

    const folders = useQuery(api.documentFolders.listFolders) ?? [];
    const createFolder = useMutation(api.documentFolders.createFolder);
    const renameFolder = useMutation(api.documentFolders.renameFolder);
    const deleteFolder = useMutation(api.documentFolders.deleteFolder);
    const moveDocuments = useMutation(api.documentFolders.moveDocuments);

    // Shared by all three filing paths (drag-and-drop, per-card ⋮ menu, and
    // the multi-select toolbar) so behavior — including never touching
    // updatedAt — stays identical no matter how the move was triggered.
    //
    // Returns the `moved` count on a successful mutation call (0 included —
    // that just means nothing resolved) or `null` if the call itself threw
    // or there was nothing to do. Never rejects: the other two move paths
    // (drag, per-card menu) rely on this resolving so their own callers
    // don't need their own try/catch. Callers that need to gate a side
    // effect (like clearing a selection) on real success should branch on
    // the return value instead of chaining unconditionally.
    const handleMoveDocuments = async (
        items: JkDraggedDocument[],
        folderId: Id<"documentFolders"> | null,
        folderName?: string,
    ): Promise<number | null> => {
        if (items.length === 0) return null;
        try {
            const { moved } = await moveDocuments({ items, folderId });
            if (moved === 0) {
                toast.info("Nothing was moved — those documents may have changed. Please try again.");
                return moved;
            }
            toast.success(
                folderId === null
                    ? `Moved ${moved} document${moved === 1 ? '' : 's'} out of the folder`
                    : `Moved ${moved} document${moved === 1 ? '' : 's'} to "${folderName ?? 'folder'}"`
            );
            return moved;
        } catch {
            toast.error("Could not move documents. Please try again.");
            return null;
        }
    };

    const handleCreateFolderAndMove = async (
        name: string,
        items: JkDraggedDocument[],
    ): Promise<number | null> => {
        try {
            const folderId = await createFolder({ name });
            return await handleMoveDocuments(items, folderId, name.trim());
        } catch {
            toast.error("Could not create folder. Please try again.");
            return null;
        }
    };

    const [openFolderId, setOpenFolderId] = useState<Id<"documentFolders"> | null>(null);
    const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    const openFolder = folders.find((folder) => folder._id === openFolderId) ?? null;
    const knownFolderIds = new Set(folders.map((folder) => String(folder._id)));

    // A folderId pointing at a deleted folder is treated as loose, so an orphaned
    // document is always reachable rather than invisible.
    const isLoose = (doc: any) =>
        !doc?.folderId || !knownFolderIds.has(String(doc.folderId));

    // If the open folder was deleted, don't strand the user inside it.
    useEffect(() => {
        if (openFolderId && !openFolder) setOpenFolderId(null);
    }, [openFolderId, openFolder]);

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

    // Resume import: (file + paste) → store original file + structured content from paste, no AI/LaTeX.
    // PDF only → legacy AI extraction + generated PDF.
    // Paste only → structured content from paste, no file.
    const handleResumeImport = async (
        file: File | null,
        name: string,
        label?: string,
        tags?: string[],
        pastedTextRaw?: string,
    ) => {
        const trimmedPaste = (pastedTextRaw ?? "").replace(/\r\n/g, "\n").trim();
        const usePastedText = trimmedPaste.length >= MIN_PASTE_RESUME_CHARS;

        if (!usePastedText) {
            if (!file) {
                toast.error("Add a PDF or paste your resume text", {
                    description: `Pasted text must be at least ${MIN_PASTE_RESUME_CHARS} characters, or choose a PDF.`,
                });
                return;
            }
            const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
            if (!isPdf) {
                toast.error("Only PDF files are supported", {
                    description: "Or paste your resume text below if you have a scanned PDF.",
                });
                return;
            }
        }

        setIsUploading(true);
        setUploadProgress(10);
        markResumeCreateSource(usePastedText ? "paste" : "upload");

        const CLIENT_AI_EXTRACT_TIMEOUT_MS = 240_000;
        const CLIENT_EXPORT_TIMEOUT_MS = 120_000;

        try {
            const resumeName =
                name.trim() ||
                (file ? file.name.replace(/\.[^/.]+$/, "") : "Resume");

            // ── Direct import: original document + pasted text → same content shape, no AI ──
            if (usePastedText) {
                setUploadStatusLabel("Saving structured content from your paste…");
                setUploadProgress(30);
                const content = buildResumeContentFromPastedText(trimmedPaste);

                let storageId: Id<"_storage"> | undefined;
                let storedFileName: string | undefined;
                let storedFileSize: number | undefined;

                if (file) {
                    setUploadProgress(45);
                    setUploadStatusLabel("Uploading your original file…");
                    const uploadUrl = await generateUploadUrl();
                    const uploadRes = await fetch(uploadUrl, {
                        method: "POST",
                        headers: { "Content-Type": file.type || "application/octet-stream" },
                        body: file,
                    });
                    if (!uploadRes.ok) throw new Error("Failed to upload file");
                    const json = await uploadRes.json();
                    if (!json.storageId) throw new Error("No storage ID returned");
                    storageId = json.storageId as Id<"_storage">;
                    storedFileName = file.name;
                    storedFileSize = file.size;
                }

                setUploadProgress(85);
                setUploadStatusLabel("Saving resume…");

                await saveGeneratedResumeWithFile({
                    name: resumeName,
                    fileId: storageId,
                    fileName: storedFileName,
                    fileSize: storedFileSize,
                    content,
                    template: editingTemplate || defaultResumeTemplateId(),
                    label: label || undefined,
                    tags: tags && tags.length > 0 ? tags : undefined,
                });

                setUploadProgress(100);
                setUploadStatusLabel("Done.");
                toast.success("Resume saved", {
                    description: file
                        ? "Your file is stored and the text is in the same structured format as other resumes—edit sections anytime."
                        : "Structured content saved from your paste—add a file later if you want a preview PDF.",
                });
                await new Promise((r) => setTimeout(r, 300));
                return;
            }

            // ── PDF only: AI extraction + LaTeX PDF (legacy) ──
            setUploadStatusLabel("Reading file…");
            setUploadProgress(15);
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.readAsDataURL(file!);
            });
            setUploadProgress(25);
            setUploadStatusLabel("Extracting resume with AI… This often takes 1–2 minutes. Progress will creep forward while we wait.");

            let aiProgressTimer: ReturnType<typeof setInterval> | undefined = setInterval(() => {
                setUploadProgress((p) => (p < 48 ? p + 1 : p));
            }, 2600);

            const extractCtrl = new AbortController();
            const extractTid = setTimeout(() => extractCtrl.abort(), CLIENT_AI_EXTRACT_TIMEOUT_MS);

            let generateResumePdfRes: Response;
            try {
                generateResumePdfRes = await fetch("/api/documents/generate-resume-pdf", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ resumePdf: base64 }),
                    signal: extractCtrl.signal,
                });
            } finally {
                clearTimeout(extractTid);
                if (aiProgressTimer) {
                    clearInterval(aiProgressTimer);
                    aiProgressTimer = undefined;
                }
            }

            if (generateResumePdfRes.status === 429) {
                throw new Error(rateLimitMessageFromResponse(generateResumePdfRes));
            }

            if (!generateResumePdfRes.ok) {
                const err = await generateResumePdfRes.json().catch(() => ({}));
                throw new Error(err.error || "Failed to extract resume");
            }

            const { content } = await generateResumePdfRes.json();
            setUploadProgress(50);
            setUploadStatusLabel("Building PDF…");

            const exportCtrl = new AbortController();
            const exportTid = setTimeout(() => exportCtrl.abort(), CLIENT_EXPORT_TIMEOUT_MS);
            let exportRes: Response;
            try {
                exportRes = await fetch(`/api/resume/export/${editingTemplate || defaultResumeTemplateId()}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content }),
                    signal: exportCtrl.signal,
                });
            } finally {
                clearTimeout(exportTid);
            }

            if (!exportRes.ok) {
                const err = await exportRes.json().catch(() => ({}));
                throw new Error(err.error || "Failed to generate PDF");
            }

            const pdfBlob = await exportRes.blob();
            setUploadProgress(70);
            setUploadStatusLabel("Uploading to storage…");

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
            setUploadStatusLabel("Saving resume…");

            const pdfFileName = `${resumeName.replace(/[^a-zA-Z0-9-_]/g, "-")}-resume.pdf`;

            await saveGeneratedResumeWithFile({
                name: resumeName,
                fileId: storageId as Id<"_storage">,
                fileName: pdfFileName,
                fileSize: pdfBlob.size,
                content,
                template: editingTemplate || defaultResumeTemplateId(),
                label: label || undefined,
                tags: tags && tags.length > 0 ? tags : undefined,
            });

            setUploadProgress(100);
            setUploadStatusLabel("Done.");
            toast.success("Resume uploaded and extracted", {
                description: "Your resume content has been extracted. You can now edit and download it.",
            });
            await new Promise((r) => setTimeout(r, 300));
        } catch (error) {
            console.error("Error uploading resume:", error);
            const aborted =
                (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") ||
                (error instanceof Error && error.name === "AbortError");
            toast.error("Failed to upload resume", {
                description: aborted
                    ? "The request took too long (server or network). Try a smaller PDF, or paste your resume text instead."
                    : error instanceof Error
                      ? error.message
                      : "Please try again.",
            });
            throw error;
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            setUploadStatusLabel("");
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
        setPastedResumeText("");
        setUploadStatusLabel("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const canSubmitResumeUpload =
        uploadName.trim().length > 0 &&
        (pendingFile !== null || pastedResumeText.trim().length >= MIN_PASTE_RESUME_CHARS);

    const handleConfirmUpload = async () => {
        if (!canSubmitResumeUpload) {
            return;
        }

        try {
            await handleResumeImport(
                pendingFile,
                uploadName,
                uploadLabel,
                uploadTags,
                pastedResumeText,
            );

            setShowUploadDialog(false);
            setPendingFile(null);
            setUploadName("");
            setUploadLabel("");
            setUploadTags([]);
            setUploadTagInput("");
            setPastedResumeText("");
        } catch (error) {
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
                    tags: editingTags,
                    template: editingTemplate || undefined,
                });
            } else {
                await updateCoverLetterMetadata({
                    coverLetterId: docId as Id<"coverLetters">,
                    name: editingName || undefined,
                    label: editingLabel || undefined,
                    tags: editingTags,
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

    // The base resume is the one the email agent tailors from for job leads
    // (resumes.isActive === true). Ordering logic lives in lib/documents/sortDocuments.ts.
    const baseResumeId = resolveBaseResumeId(allDocuments);

    // Filter documents by type and search term
    const filteredDocuments = allDocuments.filter((doc: any) => {
        // Filter by type
        if (typeFilter === "favorites") {
            if (!doc?.isFavorite) return false;
        } else if (typeFilter !== "all" && doc.documentType !== typeFilter) {
            return false;
        }

        // Folder scope. Search overrides folders entirely: when the user is
        // searching, every document is in scope regardless of where it is filed,
        // because the flat list being unsearchable is the problem folders solve.
        const isSearching = searchTerm.trim().length > 0 || typeFilter === "favorites";
        if (!isSearching) {
            if (openFolderId) {
                if (String(doc?.folderId ?? "") !== String(openFolderId)) return false;
            } else if (!isLoose(doc)) {
                return false;
            }
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

    // Base resume → favorites → regulars.
    const orderedDocuments = sortDocuments(filteredDocuments, baseResumeId);


    const resumeCount = allDocuments.filter((d: any) => d.documentType === "resume").length;
    const coverLetterCount = allDocuments.length - resumeCount;
    const favoriteCount = allDocuments.filter((d: any) => d.isFavorite).length;
    const filterCounts = { all: allDocuments.length, resume: resumeCount, "cover-letter": coverLetterCount, favorites: favoriteCount };
    const headerSub = isLoading
        ? undefined
        : [
            `${resumeCount} resume${resumeCount === 1 ? "" : "s"}`,
            `${coverLetterCount} cover letter${coverLetterCount === 1 ? "" : "s"}`,
            `${folders.length} folder${folders.length === 1 ? "" : "s"}`,
        ].join(" · ");

    // The editor (D08 / M15) takes over the page while it is open.
    if (editingContentResumeId) {
        return (
            <JkCW_DynamicJSONEditor
                key={String(editingContentResumeId)}
                resumeId={editingContentResumeId}
                onClose={() => setEditingContentResumeId(null)}
            />
        );
    }
    if (editingContentCoverLetterId) {
        return (
            <div key={String(editingContentCoverLetterId)} data-enter className="jk-stagger flex min-h-0 flex-1 flex-col">
                <JkEditorTopBar
                    title={allDocuments.find((d: any) => String(d._id) === String(editingContentCoverLetterId))?.name || "Cover letter"}
                    onBack={() => setEditingContentCoverLetterId(null)}
                />
                <div className="mx-auto w-full max-w-4xl px-5 py-6 lg:px-8">
                    <div className="overflow-hidden rounded-[20px] border border-border bg-card">
                        <JkCW_CoverLetterContentEditor
                            coverLetterId={editingContentCoverLetterId}
                            onClose={() => setEditingContentCoverLetterId(null)}
                        />
                    </div>
                </div>
            </div>
        );
    }

    const openDocument = (doc: any) => {
        const id = String(doc._id);
        if (selectionMode) {
            if (doc.documentType === "resume") toggleResumeSelection(id);
            return;
        }
        void markDocumentAsSeen(id, doc.documentType);
        selectDocument(id, doc.documentType);
        if (doc.documentType === "resume") setEditingContentResumeId(doc._id as Id<"resumes">);
        else setEditingContentCoverLetterId(doc._id as Id<"coverLetters">);
    };

    const showBaseLabel = orderedDocuments.length > 0 && baseResumeId != null && String(orderedDocuments[0]?._id) === baseResumeId;

    return (
        <div className="flex min-h-0 flex-col">
            <JkDefaultTemplateProbe onChange={setUserDefaultTemplate} />
            <JkAppPageHeader
                title="My Documents"
                sub={headerSub}
                art="papers"
                artHeight={220}
                artPosition="62% 38%"
                divider={false}
                className="lg:pb-0"
                actions={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setNewFolderName("");
                                setShowNewFolderDialog(true);
                            }}
                            className="h-9 bg-popover px-5 text-[13.5px] lg:h-10 lg:px-6"
                        >
                            New folder
                        </Button>
                        <Button onClick={() => setShowUploadDialog(true)} className="h-9 px-6 text-[14.5px] lg:h-10 lg:px-8">
                            Upload
                        </Button>
                    </>
                }
                bottom={
                    <div className="lg:mt-[34px]">
                        <JkDocFilterTabs value={typeFilter} onChange={(v) => { setTypeFilter(v); setOpenFolderId(null); }} counts={filterCounts} />
                    </div>
                }
            />

            <div data-enter className="relative flex flex-col gap-5 px-5 pb-28 pt-1 lg:gap-0 lg:px-8 lg:pb-10 lg:pt-[14px]">
            {isUploading && (
                <div className="jk-enter rounded-[16px] border border-border bg-card p-4 lg:mb-5">
                    <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 rounded-full bg-accent">
                            <div className="h-1.5 rounded-full bg-ring transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <span className="font-mono text-[12px] text-muted-foreground">{uploadProgress}%</span>
                    </div>
                    {uploadStatusLabel ? <p className="mt-2 text-xs text-muted-foreground">{uploadStatusLabel}</p> : null}
                </div>
            )}

            {selectionMode && (
                <div className="jk-enter flex flex-wrap items-center gap-2 lg:mb-5">
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={selectedResumeIds.length === 0}
                            >
                                Move to folder
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <JkMoveToFolderMenu
                                folders={folders}
                                currentFolderId={openFolderId ? String(openFolderId) : null}
                                onMove={(folderId) => {
                                    const target = folders.find(
                                        (f: JkFolder) => String(f._id) === String(folderId)
                                    );
                                    void handleMoveDocuments(
                                        selectedResumeIds.map((id) => ({ id, type: "resume" as const })),
                                        folderId,
                                        target?.name
                                    ).then((moved) => {
                                        // Only clear the selection when something actually
                                        // moved — a failed call (null) or a no-op (0, e.g.
                                        // stale ids after a concurrent delete) leaves the
                                        // user's selection intact so they can retry.
                                        if (moved) {
                                            clearResumeSelection();
                                            setSelectionMode(false);
                                        }
                                    });
                                }}
                                onCreateAndMove={(name) => {
                                    void handleCreateFolderAndMove(
                                        name,
                                        selectedResumeIds.map((id) => ({ id, type: "resume" as const }))
                                    ).then((moved) => {
                                        if (moved) {
                                            clearResumeSelection();
                                            setSelectionMode(false);
                                        }
                                    });
                                }}
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                <div className="max-w-xl lg:mb-5">
                    <JkConfirmDelete
                        message={`Delete ${selectedResumeIds.length} selected resume${selectedResumeIds.length === 1 ? '' : 's'}?`}
                        onConfirm={handleConfirmBulkDeleteResumes}
                        onCancel={() => setShowBulkDeleteConfirm(false)}
                        isLoading={isBulkDeleting}
                    />
                </div>
            )}


            {openFolder && (
                <div className="jk-enter lg:mb-5">
                    <JkFolderBreadcrumb
                        folderName={openFolder.name}
                        onBack={() => setOpenFolderId(null)}
                        onDropDocument={(payload) => {
                            void handleMoveDocuments([payload], null);
                        }}
                    />
                </div>
            )}

            {!openFolderId && folders.length > 0 && typeFilter !== "favorites" && (
                <section aria-label="Folders" className="jk-enter lg:mb-[26px]" style={{ "--i": 1 } as React.CSSProperties}>
                    <JkSectionLabel as="h2" className="hidden lg:flex">Folders</JkSectionLabel>
                    <div className="grid grid-cols-2 gap-2 lg:mt-[22px] lg:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] lg:gap-3">
                        {folders.map((folder: JkFolder, folderIndex: number) => (
                            <JkDocumentFolderCard
                                key={String(folder._id)}
                                folder={folder}
                                accent={FOLDER_ACCENTS[folderIndex % FOLDER_ACCENTS.length]}
                                count={
                                    typeFilter === "resume"
                                        ? folder.resumeCount
                                        : typeFilter === "cover-letter"
                                          ? folder.coverLetterCount
                                          : folder.resumeCount + folder.coverLetterCount
                                }
                                onOpen={() => setOpenFolderId(folder._id)}
                                onRename={(name) => {
                                    void renameFolder({ folderId: folder._id, name })
                                        .catch(() => toast.error("Could not rename folder."));
                                }}
                                onDelete={() => {
                                    void deleteFolder({ folderId: folder._id })
                                        .then(() => toast.success(`Deleted "${folder.name}". Its documents were moved out.`))
                                        .catch(() => toast.error("Could not delete folder."));
                                }}
                                onDropDocument={(payload) => {
                                    void handleMoveDocuments([payload], folder._id, folder.name);
                                }}
                            />
                        ))}
                    </div>
                </section>
            )}

            {isLoading ? (
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] lg:gap-3 lg:pt-[29px]">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-[238px] animate-pulse rounded-[18px] border border-border bg-card lg:h-[256px] lg:rounded-[20px]" />
                    ))}
                </div>
            ) : !hasDocuments ? (
                <section className="jk-enter flex flex-col items-center gap-4 rounded-[20px] border border-dashed border-input bg-card px-6 py-14 text-center lg:mt-2">
                    <JkDocPreview size="sm" className="opacity-90" />
                    <h2 className="text-[20px] font-medium text-foreground">No documents yet</h2>
                    <p className="max-w-md text-[14px] leading-5 text-muted-foreground">
                        Upload a PDF resume and we pull the content out so you can edit it here. Resumes you write in chat land here too.
                    </p>
                    <Button onClick={() => setShowUploadDialog(true)} className="h-10 px-7">Upload a resume</Button>
                </section>
            ) : orderedDocuments.length === 0 ? (
                <p className="jk-enter rounded-[18px] border border-border bg-card px-6 py-12 text-center text-[14px] text-muted-foreground lg:mt-2">
                    {typeFilter === "favorites"
                        ? "No favorites yet. Star a document to keep it here."
                        : openFolder
                          ? "This folder is empty. Drag a document onto it to file it."
                          : "Nothing here yet."}
                </p>
            ) : (
                <section aria-label="Documents">
                    <div aria-hidden className="mb-3 hidden grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-3 lg:grid">
                        {showBaseLabel && <JkSectionLabel tone="plan">Base resume</JkSectionLabel>}
                        <JkSectionLabel>{openFolder ? openFolder.name : typeFilter === "favorites" ? "Favorites" : "Recent"}</JkSectionLabel>
                    </div>
                    <div data-enter className="grid grid-cols-2 gap-2 lg:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] lg:gap-3">
                    {orderedDocuments.map((doc: any, index: number) => {
                        const resume = doc;
                        const documentType = doc.documentType || "resume";
                        const resumeId = String(resume?._id ?? resume?.id ?? `resume-${index}`);
                        const isSelectedForBulk = selectedResumeIds.includes(resumeId);
                        const title =
                            resume?.name ||
                            (resume?.jobTitle ? `${resume.jobTitle} Resume` : `Resume ${index + 1}`);
                        const isBaseResume = documentType === "resume" && baseResumeId != null && resumeId === baseResumeId;
                        const isFavorite = Boolean(resume?.isFavorite);
                        const templateName = documentType === "resume"
                            ? (resume?.template ? getResumeTemplateById(resolveResumeTemplateId(resume.template))?.name ?? null : null)
                            : null;
                        const stamp = resume?.updatedAt ?? resume?._creationTime ?? Date.now();
                        return (
                            <JkDocumentCard
                                key={resumeId}
                                index={index}
                                id={resumeId}
                                type={documentType}
                                title={title}
                                kindLabel={documentType === "resume" ? "Resume" : "Cover letter"}
                                templateShort={templateShortName(templateName)}
                                company={linkedCompanyFor(resume, allJobs)}
                                edited={editedAgo(stamp)}
                                dateShort={shortDate(stamp)}
                                isBase={isBaseResume}
                                isFavorite={isFavorite}
                                isNew={!resume?.seenAt}
                                content={resume?.content}
                                fileId={resume?.fileId}
                                selectionMode={selectionMode}
                                selected={isSelectedForBulk}
                                expanded={confirmingId === resumeId || (editingResumeId === resumeId && editingDocType === documentType)}
                                onOpen={() => openDocument(resume)}
                                onToggleFavorite={() => {
                                    void toggleFavorite({ documentId: resumeId, documentType }).catch(() => {
                                        toast.error("Could not update favorite. Please try again.");
                                    });
                                }}
                                menu={
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <JkDocMenuTrigger label={`${title} options`} />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                                                        {/* Edit content - for both resumes and cover letters */}
                                                        <DropdownMenuItem
                                                            onClick={async (event) => {
                                                                event.stopPropagation();
                                                                await markDocumentAsSeen(resumeId, documentType);
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
                                                        <DropdownMenuItem
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                void toggleFavorite({ documentId: resumeId, documentType }).catch(() => toast.error("Could not update favorite. Please try again."));
                                                            }}
                                                        >
                                                            <Star className="h-4 w-4" />
                                                            <span>{isFavorite ? "Remove from favorites" : "Add to favorites"}</span>
                                                        </DropdownMenuItem>
                                                        {documentType === "resume" && !isBaseResume && (
                                                            <DropdownMenuItem
                                                                disabled={settingBaseId === resumeId}
                                                                onClick={(event) => void handleSetBaseResume(resumeId, event)}
                                                            >
                                                                <Pin className="h-4 w-4" />
                                                                <span>Make this my base resume</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {documentType === "resume" && (
                                                            <DropdownMenuItem
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    handleEnterSelectionMode();
                                                                    toggleResumeSelection(resumeId);
                                                                }}
                                                            >
                                                                <CheckCircle2 className="h-4 w-4" />
                                                                <span>Select</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {/* Download - works for both if they have a fileId */}
                                                        {resume?.fileId && (
                                                            <DropdownMenuItem
                                                                onClick={async (event) => {
                                                                    event.stopPropagation();
                                                                    downloadFirstVersionResume(resume.fileId, resume.name);
                                                                    void markDocumentAsSeen(resumeId, documentType);
                                                                }}
                                                            >
                                                                <Download className="h-4 w-4" />
                                                                <span>Download PDF</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {documentType === "resume" && resume?.fileId && (
                                                            <DropdownMenuItem
                                                                onClick={async (event) => {
                                                                    event.stopPropagation();
                                                                    try {
                                                                        const result = await shareResumeMutation({ resumeId: resume._id });
                                                                        if (result.shared) {
                                                                            await navigator.clipboard.writeText(result.url);
                                                                            toast.success("Share link copied", { description: result.url });
                                                                        }
                                                                    } catch (error) {
                                                                        console.error("Failed to share:", error);
                                                                        toast.error("Could not create share link");
                                                                    }
                                                                }}
                                                            >
                                                                <Link2 className="h-4 w-4" />
                                                                <span>Copy share link</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {documentType === "resume" && resume?.shareId && (
                                                            <DropdownMenuItem
                                                                onClick={async (event) => {
                                                                    event.stopPropagation();
                                                                    try {
                                                                        await shareResumeMutation({ resumeId: resume._id, off: true });
                                                                        toast.success("Share link turned off");
                                                                    } catch (error) {
                                                                        console.error("Failed to unshare:", error);
                                                                        toast.error("Could not turn off share link");
                                                                    }
                                                                }}
                                                            >
                                                                <Link2Off className="h-4 w-4" />
                                                                <span>Stop sharing</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            onClick={async (event) => {
                                                                event.stopPropagation();
                                                                try {
                                                                    if (documentType === "resume") {
                                                                        await duplicateResumeMutation({ resumeId: resume._id });
                                                                    } else {
                                                                        await duplicateCoverLetterMutation({ coverLetterId: resume._id as Id<"coverLetters"> });
                                                                    }
                                                                    toast.success(`Duplicated "${title}"`);
                                                                } catch (error) {
                                                                    console.error("Failed to duplicate:", error);
                                                                    toast.error("Failed to duplicate document");
                                                                }
                                                            }}
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                            <span>Duplicate</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <div className="px-1 py-1">
                                                            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                Move to folder
                                                            </p>
                                                            <JkMoveToFolderMenu
                                                                folders={folders}
                                                                currentFolderId={resume?.folderId ? String(resume.folderId) : null}
                                                                onMove={(folderId) => {
                                                                    const target = folders.find(
                                                                        (f: JkFolder) => String(f._id) === String(folderId)
                                                                    );
                                                                    void handleMoveDocuments(
                                                                        [{ id: resumeId, type: documentType }],
                                                                        folderId,
                                                                        target?.name
                                                                    );
                                                                }}
                                                                onCreateAndMove={(name) => {
                                                                    void handleCreateFolderAndMove(name, [
                                                                        { id: resumeId, type: documentType },
                                                                    ]);
                                                                }}
                                                            />
                                                        </div>
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
                                }
                                below={
                                    <div onClick={(event) => event.stopPropagation()} className="cursor-auto">
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
                                                            className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand"
                                                        >
                                                            {tag}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveTag(tag)}
                                                                className="hover:text-brand"
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
                                    
                                    </div>
                                }
                            />
                        );
                    })}
                    </div>
                </section>
            )}
            </div>


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
                                : "Choose a PDF, or paste your resume text if the PDF is scanned (image-only)."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        {!pendingFile ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-brand/50 hover:bg-muted/30 py-10 px-4 transition-colors"
                                >
                                    <Upload className="h-10 w-10 text-muted-foreground" />
                                    <span className="text-sm font-medium text-foreground">Choose PDF file</span>
                                    <span className="text-xs text-muted-foreground">Optional if you paste text below</span>
                                </button>
                                <p className="text-center text-xs text-muted-foreground">or</p>
                                <div className="space-y-2">
                                    <label htmlFor="paste-resume-main" className="text-sm font-medium text-foreground">
                                        Paste resume text <span className="text-muted-foreground font-normal">(for scanned PDFs)</span>
                                    </label>
                                    <Textarea
                                        id="paste-resume-main"
                                        value={pastedResumeText}
                                        onChange={(e) => setPastedResumeText(e.target.value)}
                                        placeholder="Paste the full text of your resume here…"
                                        rows={5}
                                        showBorder
                                        size="sm"
                                        className="field-sizing-fixed min-h-[100px] max-h-[min(42vh,240px)] overflow-y-auto resize-none"
                                        disabled={isUploading}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        At least {MIN_PASTE_RESUME_CHARS} characters if you are not uploading a PDF.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="upload-name-main-pre" className="text-sm font-medium text-foreground">
                                        Name <span className="text-muted-foreground">(required)</span>
                                    </label>
                                    <Input
                                        id="upload-name-main-pre"
                                        value={uploadName}
                                        onChange={(e) => setUploadName(e.target.value)}
                                        placeholder="e.g., Software Engineer Resume"
                                        className="h-9"
                                        disabled={isUploading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="upload-label-main-pre" className="text-sm font-medium text-foreground">
                                        Label <span className="text-muted-foreground">(optional)</span>
                                    </label>
                                    <Input
                                        id="upload-label-main-pre"
                                        value={uploadLabel}
                                        onChange={(e) => setUploadLabel(e.target.value)}
                                        placeholder="e.g., Software Engineer, Marketing Manager"
                                        className="h-9"
                                        disabled={isUploading}
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
                                                className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveUploadTag(tag)}
                                                    className="hover:text-brand"
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
                                            disabled={isUploading}
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddUploadTag}
                                            disabled={!uploadTagInput.trim() || isUploading}
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
                                                    className="h-2 rounded-full bg-brand transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">{uploadProgress}%</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center">
                                            {uploadStatusLabel || "Uploading your resume…"}
                                        </p>
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={handleCancelUpload} disabled={isUploading}>
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleConfirmUpload}
                                        disabled={!canSubmitResumeUpload || isUploading}
                                    >
                                        {isUploading ? "Uploading..." : "Save resume"}
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
                                    <label htmlFor="paste-resume-main-file" className="text-sm font-medium text-foreground">
                                        Paste text instead <span className="text-muted-foreground font-normal">(if PDF is scanned)</span>
                                    </label>
                                    <Textarea
                                        id="paste-resume-main-file"
                                        value={pastedResumeText}
                                        onChange={(e) => setPastedResumeText(e.target.value)}
                                        placeholder="If extraction fails or your PDF has no selectable text, paste your resume here. Pasted text takes priority over the file."
                                        rows={3}
                                        showBorder
                                        size="sm"
                                        className="field-sizing-fixed min-h-[80px] max-h-[min(36vh,200px)] overflow-y-auto resize-none"
                                        disabled={isUploading}
                                    />
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
                                        disabled={isUploading}
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
                                        disabled={isUploading}
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
                                                className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveUploadTag(tag)}
                                                    className="hover:text-brand"
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
                                            disabled={isUploading}
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddUploadTag}
                                            disabled={!uploadTagInput.trim() || isUploading}
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
                                                    className="h-2 rounded-full bg-brand transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">{uploadProgress}%</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center">
                                            {uploadStatusLabel || "Uploading your resume…"}
                                        </p>
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
                                        disabled={!canSubmitResumeUpload || isUploading}
                                    >
                                        {isUploading ? "Uploading..." : "Upload Resume"}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showNewFolderDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowNewFolderDialog(false);
                        setNewFolderName("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>New folder</DialogTitle>
                        <DialogDescription>
                            Group your documents. A document can live in one folder at a time.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        autoFocus
                        value={newFolderName}
                        onChange={(event) => setNewFolderName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && newFolderName.trim()) {
                                event.preventDefault();
                                void createFolder({ name: newFolderName })
                                    .then(() => {
                                        setShowNewFolderDialog(false);
                                        setNewFolderName("");
                                    })
                                    .catch(() => toast.error("Could not create folder."));
                            }
                        }}
                        placeholder="e.g., Design roles"
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowNewFolderDialog(false);
                                setNewFolderName("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={!newFolderName.trim()}
                            onClick={() => {
                                void createFolder({ name: newFolderName })
                                    .then(() => {
                                        setShowNewFolderDialog(false);
                                        setNewFolderName("");
                                    })
                                    .catch(() => toast.error("Could not create folder."));
                            }}
                        >
                            Create folder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <JkGap size="small" />
        </div>
    );
}