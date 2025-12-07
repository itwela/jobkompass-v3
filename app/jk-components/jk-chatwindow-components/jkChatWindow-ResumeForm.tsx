'use client'

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import React, { useEffect, useMemo, useState } from "react";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { cn } from "@/lib/utils";
import { CalendarClock, FileText, ChevronRight, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import JkGap from "../jkGap";
import JkConfirmDelete from "../jkConfirmDelete";

export default function JkCW_ResumeForm() {

    const {
        currentResumeId,
        setCurrentResumeId,
        resumes,
        selectionMode,
        setSelectionMode,
        selectedResumeIds,
        toggleResumeSelection,
        selectAllResumes,
        clearResumeSelection,
        bulkDeleteResumes,
    } = useJobKompassResume();

    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    useEffect(() => {
        if (!selectionMode) {
            setShowBulkDeleteConfirm(false);
            setIsBulkDeleting(false);
        }
    }, [selectionMode]);

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

    const handleResumeClick = (id: string) => {
        if (selectionMode) {
            toggleResumeSelection(id);
            return;
        }
        setCurrentResumeId(id);
    };

    const handleResumeDelete = async (resumeId: string) => {
        setIsDeleting(resumeId);
        try {
            await bulkDeleteResumes([resumeId]);

            if (currentResumeId === resumeId) {
                const remaining = resumeList.filter((resume: any) => String(resume._id) !== resumeId);
                const next = remaining[0]?._id ?? null;
                setCurrentResumeId(next ?? null);
            }
        } catch (error) {
            console.error("Error deleting resume:", error);
        } finally {
            setIsDeleting(null);
        }
    };

    const resumesLoading = resumes === undefined;
    const resumeList = Array.isArray(resumes) ? resumes : [];
    const hasResumes = resumeList.length > 0;

    useEffect(() => {
        if (!resumesLoading && hasResumes && !currentResumeId) {
            const firstResume = resumeList[0];
            if (firstResume?._id) {
                setCurrentResumeId(firstResume._id);
            }
        }
    }, [resumesLoading, hasResumes, currentResumeId, resumeList, setCurrentResumeId]);

    const filteredResumes = resumeList.filter((resume: any) => {
        const title = (resume?.name || resume?.jobTitle || "").toString().toLowerCase();
        const role = (resume?.targetRole || "").toString().toLowerCase();
        const search = searchTerm.toLowerCase().trim();
        if (!search) return true;
        return title.includes(search) || role.includes(search);
    });

    const resumeDetail = useQuery(
        api.documents.getResume,
        currentResumeId ? { resumeId: currentResumeId as Id<"resumes"> } : "skip"
    );

    const resumeDetailLoading = Boolean(currentResumeId && resumeDetail === undefined);
    const activeResumeContent = useMemo(() => resumeDetail?.content, [resumeDetail]);

    if (resumesLoading) {
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

    if (!hasResumes) {
        return (
            <div className="space-y-6">
                <section className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-8 py-14 text-center">
                    <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
                        <div className="inline-flex size-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-xl font-semibold">No resumes yet</h2>
                            <p className="text-sm text-muted-foreground">
                                Create your first resume using the builder to see it appear here.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-foreground/70" />
                            <span>
                                <span className="font-semibold text-foreground">{resumeList.length}</span> saved resumes
                            </span>
                        </div>
                    </div>
                    {!selectionMode && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEnterSelectionMode}
                        >
                            Multi-select
                        </Button>
                    )}
                </div>
                <Input
                    type="search"
                    placeholder="Search resumes by title or role..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full max-w-sm"
                />
            </div>

            {selectionMode && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        {selectedResumeIds.length} selected
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllResumes(filteredResumes.map((resume: any) => String(resume?._id ?? resume?.id)))}
                        disabled={filteredResumes.length === 0 || selectedResumeIds.length === filteredResumes.length}
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

            {filteredResumes.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/10 px-6 py-12 text-center text-sm text-muted-foreground">
                    No resumes match “{searchTerm}”. Try a different keyword or generate new samples.
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredResumes.map((resume: any, index: number) => {
                        const resumeId = String(resume?._id ?? resume?.id ?? `resume-${index}`);
                        const isActive = currentResumeId === resumeId;
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

                        return (
                            <div
                                key={resumeId}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleResumeClick(resumeId)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        handleResumeClick(resumeId);
                                    }
                                }}
                                className={cn(
                                    "group flex h-full max-h-[200px] flex-col gap-4 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                                    isActive ? "border-blue-400 shadow-sm shadow-blue-200/40" : "border-border",
                                    selectionMode && isSelectedForBulk && "border-blue-500 ring-2 ring-blue-200"
                                )}
                            >
                                <div className="relative overflow-hidden rounded-xl border border-border/70 bg-background/80">
                                    <div className="aspect-[3/4] w-full bg-gradient-to-br from-blue-100 via-white to-muted/40">
                                        <div className="flex h-full flex-col justify-between p-4 text-xs text-muted-foreground">
                                            <div className="space-y-2">
                                                <div className="h-2 w-2/3 rounded bg-foreground/60 opacity-40" />
                                                <div className="h-2 w-full rounded bg-foreground/40 opacity-30" />
                                                <div className="h-2 w-5/6 rounded bg-foreground/40 opacity-30" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="h-1.5 w-full rounded bg-foreground/30 opacity-20" />
                                                <div className="h-1.5 w-4/5 rounded bg-foreground/30 opacity-20" />
                                                <div className="h-1.5 w-3/5 rounded bg-foreground/30 opacity-20" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/90 via-background/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-foreground">{title}</p>
                                            <p className="text-xs text-muted-foreground">Focus: {roleFocus}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectionMode ? (
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
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-8 w-8 text-muted-foreground hover:text-destructive",
                                                        "transition-colors",
                                                        (isDeleting === resumeId || confirmingId === resumeId) && "opacity-50"
                                                    )}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setConfirmingId(resumeId);
                                                    }}
                                                    disabled={isDeleting === resumeId}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <ChevronRight
                                                className={cn(
                                                    "mt-1 h-4 w-4 flex-shrink-0 transition-transform duration-200",
                                                    isActive
                                                        ? "text-blue-500"
                                                        : selectionMode && isSelectedForBulk
                                                          ? "text-blue-500"
                                                          : "text-muted-foreground group-hover:translate-x-1"
                                                )}
                                            />
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
                                                    void handleResumeDelete(resumeId).finally(() => {
                                                        setConfirmingId(null);
                                                    });
                                                }}
                                                onCancel={() => setConfirmingId(null)}
                                                isLoading={isDeleting === resumeId}
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{updatedAt}</span>
                                        {isActive ? (
                                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Select
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <section className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
                {resumeDetailLoading ? (
                    <div className="space-y-4">
                        <div className="h-8 w-48 animate-pulse rounded bg-muted/40" />
                        <div className="grid gap-4 md:grid-cols-2">
                            {Array.from({ length: 4 }).map((_, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
                                    <div className="h-9 w-full animate-pulse rounded bg-muted/30" />
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, idx) => (
                                <div key={idx} className="h-3 w-full animate-pulse rounded bg-muted/30" />
                            ))}
                        </div>
                    </div>
                ) : activeResumeContent ? (
                    <div className="space-y-8">
                        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h3 className="text-2xl font-semibold text-foreground">
                                    {resumeDetail?.name ?? "Selected Resume"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Last updated{" "}
                                    {resumeDetail?.updatedAt
                                        ? new Date(resumeDetail.updatedAt).toLocaleDateString()
                                        : "recently"}
                                </p>
                            </div>
                            <div className="flex gap-2 text-sm text-muted-foreground">
                                <span>
                                    {activeResumeContent?.experience?.length ?? 0} experiences ·{" "}
                                    {activeResumeContent?.projects?.length ?? 0} projects
                                </span>
                            </div>
                        </header>

                        <div className="grid gap-6 md:grid-cols-3">
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Personal Info
                                </h4>
                                <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-4 text-sm">
                                    <p className="font-medium text-foreground">
                                        {activeResumeContent.personalInfo?.name}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {activeResumeContent.personalInfo?.email}
                                    </p>
                                    {activeResumeContent.personalInfo?.phone && (
                                        <p className="text-muted-foreground">
                                            {activeResumeContent.personalInfo.phone}
                                        </p>
                                    )}
                                    {activeResumeContent.personalInfo?.location && (
                                        <p className="text-muted-foreground">
                                            {activeResumeContent.personalInfo.location}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 md:col-span-2">
                                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Summary
                                </h4>
                                <div className="rounded-xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                                    {activeResumeContent.personalInfo?.summary ? (
                                        <p>{activeResumeContent.personalInfo.summary}</p>
                                    ) : (
                                        <p className="italic text-muted-foreground/70">
                                            No summary provided.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Experience
                                </h4>
                                {activeResumeContent.experience?.length ? (
                                    <span className="text-xs text-muted-foreground">
                                        Showing first {Math.min(3, activeResumeContent.experience.length)} roles
                                    </span>
                                ) : null}
                            </div>
                            <div className="space-y-3">
                                {activeResumeContent.experience?.length ? (
                                    activeResumeContent.experience.slice(0, 3).map((role, idx) => (
                                        <div
                                            key={`${role.company}-${role.position}-${idx}`}
                                            className="rounded-xl border border-border/70 bg-background/80 p-4 text-sm"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-foreground">{role.position}</p>
                                                    <p className="text-muted-foreground">{role.company}</p>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {role.startDate}
                                                    {role.endDate ? ` – ${role.endDate}` : ""}
                                                </span>
                                            </div>
                                            <p className="mt-3 text-muted-foreground">{role.description}</p>
                                            {role.achievements?.length ? (
                                                <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground/90">
                                                    {role.achievements.slice(0, 3).map((item, subIdx) => (
                                                        <li key={subIdx}>{item}</li>
                                                    ))}
                                                </ul>
                                            ) : null}
                                        </div>
                                    ))
                                ) : (
                                    <p className="rounded-xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                                        No experience entries yet.
                                    </p>
                                )}
                            </div>
                        </div>

                        {activeResumeContent.skills?.length ? (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Skills
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {activeResumeContent.skills.map((skill: string, idx: number) => (
                                        <span
                                            key={`${skill}-${idx}`}
                                            className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-foreground"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
                        <p>Select a resume to view its details.</p>
                        <p className="text-xs text-muted-foreground/80">
                            Choose one of the cards above to preview the stored content.
                        </p>
                    </div>
                )}
            </section>

            <JkGap />
        </div>
    );
}