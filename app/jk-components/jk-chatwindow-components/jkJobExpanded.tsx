'use client'

import { useJobs } from "@/providers/jkJobsProvider";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ExternalLink,
  Calendar,
  Briefcase,
  Tag,
  CheckCircle2,
  XCircle,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef, useEffect, useMemo } from "react";
import JkConfirmDelete from "../jkConfirmDelete";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function JkJobExpanded() {
  const {
    allJobs,
    selectedJobId,
    setSelectedJobId,
    handleDeleteJob,
    handleUpdateJob,
    statusOptions,
  } = useJobs();
  const { resumes } = useJobKompassResume();
  const { coverLetterList } = useJobKompassDocuments();
  const markJobAsSeen = useMutation(api.jobs.markJobAsSeen);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  // Mark job as seen when expanded view is opened
  useEffect(() => {
    if (selectedJobId) {
      markJobAsSeen({ jobId: selectedJobId }).catch((error) => {
        // Silently fail - don't interrupt user experience
        console.error('Failed to mark job as seen:', error);
      });
    }
  }, [selectedJobId, markJobAsSeen]);

  // Get unique resume names from saved resumes
  const resumeNames = useMemo(() => {
    if (!resumes || !Array.isArray(resumes)) return [];
    return resumes
      .map((r: any) => r.name || r.title || "Untitled Resume")
      .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index);
  }, [resumes]);

  // Get unique cover letter names from saved cover letters
  const coverLetterNames = useMemo(() => {
    if (!coverLetterList || !Array.isArray(coverLetterList)) return [];
    return coverLetterList
      .map((cl: any) => cl.name || "Untitled Cover Letter")
      .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index);
  }, [coverLetterList]);

  const job = selectedJobId ? allJobs.find((j) => j._id === selectedJobId) : null;

  const emptyForm = useMemo(
    () => ({
      company: "",
      title: "",
      link: "",
      status: statusOptions[0]?.value ?? "Interested",
      compensation: "",
      dateApplied: "",
      interviewed: false,
      easyApply: "",
      resumeUsed: "",
      coverLetterUsed: "",
      description: "",
      notes: "",
      skills: [] as string[],
      keywords: [] as string[],
    }),
    [statusOptions]
  );

  const initialForm = useMemo(() => {
    if (!job) return emptyForm;
    return {
      company: job.company ?? "",
      title: job.title ?? "",
      link: job.link ?? "",
      status:
        statusOptions.find((option) => option.value === job.status)?.value ??
        statusOptions[0]?.value ??
        "Interested",
      compensation: job.compensation ?? "",
      dateApplied: job.dateApplied ?? "",
      interviewed: job.interviewed ?? false,
      easyApply: job.easyApply ?? "",
      resumeUsed: job.resumeUsed ?? "",
      coverLetterUsed: job.coverLetterUsed ?? "",
      description: job.description ?? "",
      notes: job.notes ?? "",
      skills: Array.isArray(job.skills) ? [...job.skills] : [],
      keywords: Array.isArray(job.keywords) ? [...job.keywords] : [],
    };
  }, [job, statusOptions, emptyForm]);

  const [formState, setFormState] = useState(initialForm);

  useEffect(() => {
    setFormState(initialForm);
    setSkillInput("");
    setKeywordInput("");
    setSaveMessage(null);
    setSaveError(null);
  }, [initialForm]);

  useEffect(() => {
    if (selectedJobId && !job) {
      setSelectedJobId(null);
    }
    setShowDeleteConfirm(false);
    setIsDeleting(false);
  }, [job, selectedJobId, setSelectedJobId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkOverflow = () => {
      const hasVerticalOverflow = container.scrollHeight > container.clientHeight;
      setHasOverflow(hasVerticalOverflow);
    };

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setIsAtBottom(isNearBottom);
    };

    checkOverflow();
    handleScroll();

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', checkOverflow);

    const timeoutId = setTimeout(checkOverflow, 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', checkOverflow);
      clearTimeout(timeoutId);
    };
  }, [job]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(initialForm) !== JSON.stringify(formState);
  }, [initialForm, formState]);

  const handleScrollClick = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (isAtBottom) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

  if (!job) return null;

  const handleConfirmDelete = async () => {
    if (!job) return;
    setIsDeleting(true);
    try {
      await handleDeleteJob(job._id);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFieldChange =
    (field: keyof typeof formState) =>
    (value: string | boolean) => {
      setFormState((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || formState.skills.includes(trimmed)) return;
    setFormState((prev) => ({
      ...prev,
      skills: [...prev.skills, trimmed],
    }));
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setFormState((prev) => ({
      ...prev,
      skills: prev.skills.filter((item) => item !== skill),
    }));
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed || formState.keywords.includes(trimmed)) return;
    setFormState((prev) => ({
      ...prev,
      keywords: [...prev.keywords, trimmed],
    }));
    setKeywordInput("");
  };

  const removeKeyword = (keyword: string) => {
    setFormState((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((item) => item !== keyword),
    }));
  };

  const handleSave = async () => {
    if (!job || !hasChanges) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = {
        company: formState.company.trim(),
        title: formState.title.trim(),
        link: formState.link.trim(),
        status: formState.status,
        compensation: formState.compensation.trim() || undefined,
        keywords: formState.keywords,
        skills: formState.skills,
        description: formState.description.trim() || undefined,
        dateApplied: formState.dateApplied.trim() || undefined,
        interviewed: formState.interviewed,
        easyApply: formState.easyApply.trim() || undefined,
        resumeUsed: formState.resumeUsed.trim() || undefined,
        coverLetterUsed: formState.coverLetterUsed.trim() || undefined,
        notes: formState.notes.trim() || undefined,
      };

      await handleUpdateJob(job._id, payload);
      setSaveMessage("Saved");
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (error) {
      console.error("Failed to update job:", error);
      setSaveError("Unable to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setSelectedJobId(null)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto no-scrollbar relative"
          ref={scrollContainerRef}
        >
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-2xl font-bold">Job Details</h2>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormState(initialForm);
                  setSkillInput("");
                  setKeywordInput("");
                }}
                disabled={!hasChanges || isSaving}
              >
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDeleteConfirm((prev) => !prev);
                }}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedJobId(null)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showDeleteConfirm && (
            <div
              className="px-6 pt-4"
              onClick={(event) => event.stopPropagation()}
            >
              <JkConfirmDelete
                message="Remove this job from your tracker?"
                onConfirm={() => {
                  if (isDeleting) return;
                  void handleConfirmDelete();
                }}
                onCancel={() => setShowDeleteConfirm(false)}
                isLoading={isDeleting}
              />
            </div>
          )}

          <div className="p-6 space-y-8">
            <div className="space-y-4">
              <Input
                value={formState.title}
                onChange={(event) => handleFieldChange("title")(event.target.value)}
                placeholder="Job title"
                className="text-3xl font-bold bg-transparent border-0 px-0 focus-visible:ring-0"
              />
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={formState.company}
                  onChange={(event) => handleFieldChange("company")(event.target.value)}
                  placeholder="Company name"
                  className="text-lg bg-transparent border-0 px-0 focus-visible:ring-0"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => handleFieldChange("status")(status.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      formState.status === status.value
                        ? status.colorClass
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">Job link</label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="url"
                  value={formState.link}
                  onChange={(event) => handleFieldChange("link")(event.target.value)}
                  placeholder="https://company.com/jobs/123"
                />
                {formState.link && (
                  <a
                    href={formState.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-800 hover:text-blue-900 hover:underline text-sm"
                  >
                    Visit <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">Compensation</label>
              <Input
                value={formState.compensation}
                onChange={(event) => handleFieldChange("compensation")(event.target.value)}
                placeholder="e.g., $100k-$150k, €60k, Competitive"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date applied
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
                      handleFieldChange("dateApplied")(today);
                    }}
                    className="text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    Today?
                  </button>
                </div>
                <Input
                  value={formState.dateApplied}
                  onChange={(event) => handleFieldChange("dateApplied")(event.target.value)}
                  placeholder="e.g. 2024-05-01"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Interview status
                </label>
                <Button
                  variant={formState.interviewed ? "default" : "outline"}
                  onClick={() => handleFieldChange("interviewed")(!formState.interviewed)}
                  className="flex items-center gap-2 justify-start"
                >
                  {formState.interviewed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Interviewed
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Not yet
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Easy apply / platform
                </label>
                <Input
                  value={formState.easyApply}
                  onChange={(event) => handleFieldChange("easyApply")(event.target.value)}
                  placeholder="LinkedIn, internal portal, etc."
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Resume used
                </label>
                {resumeNames.length > 0 ? (
                  <Select
                    value={formState.resumeUsed}
                    onValueChange={(value) => handleFieldChange("resumeUsed")(value)}
                  >
                    <SelectTrigger className="w-full border border-input">
                      <SelectValue placeholder="Select a resume..." />
                    </SelectTrigger>
                    <SelectContent>
                      {resumeNames.map((name: string) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formState.resumeUsed}
                    onChange={(event) => handleFieldChange("resumeUsed")(event.target.value)}
                    placeholder="Resume version"
                    autoComplete="off"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Cover letter used
                </label>
                {coverLetterNames.length > 0 ? (
                  <Select
                    value={formState.coverLetterUsed}
                    onValueChange={(value) => handleFieldChange("coverLetterUsed")(value)}
                  >
                    <SelectTrigger className="w-full border border-input">
                      <SelectValue placeholder="Select a cover letter..." />
                    </SelectTrigger>
                    <SelectContent>
                      {coverLetterNames.map((name: string) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formState.coverLetterUsed}
                    onChange={(event) => handleFieldChange("coverLetterUsed")(event.target.value)}
                    placeholder="Optional"
                    autoComplete="off"
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Required Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {formState.skills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="px-3 py-1 bg-muted rounded-full text-sm flex items-center gap-1 hover:bg-muted/80 transition"
                  >
                    {skill}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Add a skill and press Enter"
                />
                <Button type="button" size="sm" onClick={addSkill} disabled={!skillInput.trim()}>
                  Add
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Keywords
              </label>
              <div className="flex flex-wrap gap-2">
                {formState.keywords.map((keyword) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => removeKeyword(keyword)}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1 hover:bg-blue-200 transition"
                  >
                    {keyword}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="Add a keyword and press Enter"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={addKeyword}
                  disabled={!keywordInput.trim()}
                  variant="outline"
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                value={formState.description}
                onChange={(event) => handleFieldChange("description")(event.target.value)}
                placeholder="Role summary, responsibilities, etc."
                className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <textarea
                value={formState.notes}
                onChange={(event) => handleFieldChange("notes")(event.target.value)}
                placeholder="Interview prep, follow-ups, reminders..."
                className="min-h-[120px] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="text-xs text-muted-foreground">
                <p>Created {new Date(job.createdAt).toLocaleDateString()}</p>
                <p>Last updated {new Date(job.updatedAt).toLocaleDateString()}</p>
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              {saveMessage && <p className="text-sm text-green-600">{saveMessage}</p>}
            </div>
          </div>

          {hasOverflow && (
            <div className="sticky bottom-4 flex justify-end mr-4 z-20 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="pointer-events-auto"
              >
                <Button
                  onClick={handleScrollClick}
                  size="icon"
                  className="h-10 w-10 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[#FFA726] text-white hover:bg-[#FB8C00]"
                >
                  {isAtBottom ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </motion.div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

