'use client'

import { useEffect, useState } from "react";
import { useJobs } from "@/providers/jkJobsProvider";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useAuth } from "@/providers/jkAuthProvider";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, Filter, Search, X, Plus } from "lucide-react";
import { motion } from "framer-motion";
import JkJobsGrid from "./jkJobsGrid";
import JkJobExpanded from "./jkJobExpanded";
import JkConfirmDelete from "../jkConfirmDelete";
import JkGap from "../jkGap";
import JkTemplateSelector, { TemplateType } from "../jkTemplateSelector";
import JkUpgradeModal from "../jkUpgradeModal";
import JkJobInputModal from "../jkJobInputModal";
import { toast } from "@/lib/toast";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function JkCW_MyJobsMode() {
  const {
    isAuthenticated,
    authLoading,
    selectionMode,
    setSelectionMode,
    selectedJobIds,
    selectAllJobs,
    clearJobSelection,
    handleBulkDeleteJobs,
    allJobs,
    setSelectedJobId,
    filteredJobs,
    searchQuery,
    setSearchQuery,
    statusOptions,
    statusCounts,
    selectedStatus,
    setSelectedStatus,
    setJobSelection,
  } = useJobs();
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSelectorType, setTemplateSelectorType] = useState<TemplateType>('resume');
  const [selectedJobForGeneration, setSelectedJobForGeneration] = useState<any | null>(null);
  const [selectedReferenceResumeId, setSelectedReferenceResumeId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isJobInputModalOpen, setIsJobInputModalOpen] = useState(false);
  const { user } = useAuth();
  const { resumes, resumePreferences } = useJobKompassResume();
  const { canGenerateDocument, upgradeModal, setUpgradeModal } = useFeatureAccess();
  const markJobAsSeen = useMutation(api.jobs.markJobAsSeen);

  useEffect(() => {
    if (!selectionMode) {
      setShowBulkDeleteConfirm(false);
      setIsBulkDeleting(false);
    }
  }, [selectionMode]);

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedJobId(null);
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    clearJobSelection();
  };

  const handleSelectAllVisible = () => {
    setJobSelection(filteredJobs.map((job) => job._id));
  };

  const handleConfirmBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      await handleBulkDeleteJobs();
      setShowBulkDeleteConfirm(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  /** Receives full job object from grid (not jobId/jobTitle/jobCompany) so toast and API get company. */
  const handleOpenTemplateSelector = (
    type: TemplateType,
    job: { _id: Id<"jobs">; title: string; company: string },
  ) => {
    setTemplateSelectorType(type);
    setSelectedJobForGeneration(job);
    setSelectedReferenceResumeId(null);
    setIsTemplateModalOpen(true);
  };

  const handleTemplateSelect = async (templateId: string, resumeInput?: { referenceResumeId?: string; resumePdf?: string; resumeText?: string; promptText?: string }) => {
    if (!selectedJobForGeneration) return;

    setIsGenerating(true);
    const typeLabel = templateSelectorType === 'resume' ? 'resume' : 'cover letter';
    const toastId = toast.loading(`Generating ${typeLabel} for ${selectedJobForGeneration.company ? selectedJobForGeneration.company : 'you'}...`);

    try {
      const body: Record<string, unknown> = {
        templateType: templateSelectorType,
        templateId: templateId,
        jobId: selectedJobForGeneration._id?.toString(),
        jobTitle: selectedJobForGeneration.title,
        jobCompany: selectedJobForGeneration.company,
      };
      if (templateSelectorType === 'resume' && resumeInput) {
        body.referenceResumeId = resumeInput.referenceResumeId ?? undefined;
        body.resumePdf = resumeInput.resumePdf;
        body.resumeText = resumeInput.resumeText;
        body.promptText = resumeInput.promptText;
      } else if (templateSelectorType === 'resume') {
        body.referenceResumeId = selectedReferenceResumeId ?? undefined;
      }

      const response = await fetch('/api/template/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Check if it's a limit error
        if (data.limitReached || response.status === 403) {
          // Trigger the modal by calling canGenerateDocument (which will show modal if limit reached)
          canGenerateDocument();
          throw new Error(data.message || 'Document limit reached');
        }
        throw new Error(data.error || 'Failed to generate document');
      }

      toast.dismiss(toastId);
      const documentType = templateSelectorType === 'resume' ? 'Resume' : 'Cover letter';
      toast.success(`${documentType} for ${selectedJobForGeneration.company} generated!`, {
        description: `Your ${typeLabel} is ready. Check your documents to see your new ${typeLabel} for ${selectedJobForGeneration.title} at ${selectedJobForGeneration.company}.`
      });
      
      setIsTemplateModalOpen(false);
      setSelectedJobForGeneration(null);
    } catch (error) {
      console.error('Error generating document:', error);
      toast.dismiss(toastId);
      toast.error(`Failed to generate ${typeLabel}`, {
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto w-full px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-semibold mb-2">Sign in required</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Please sign in to view and manage your applied jobs. Click the JobKompass icon in the sidebar to sign in.
            </p>
            <Button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('jk:openSignIn'));
              }} 
              className="gap-2"
            >
              <LogIn className="h-4 w-4" />
              Open Sign In
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full !no-scrollbar">
      <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto w-full px-6 py-8">
          {/* Header */}
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Jobs</h1>
              <p className="text-muted-foreground mt-1">Track and manage your job applications</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!selectionMode ? (
                <>
                  <Button variant="outline" onClick={handleEnterSelectionMode}>
                    Multi-select
                  </Button>
                  <Button 
                    variant={isJobInputModalOpen ? "outline" : "default"}
                    className={isJobInputModalOpen ? "" : "bg-primary hover:bg-primary/90"}
                    onClick={() => setIsJobInputModalOpen(!isJobInputModalOpen)}
                  >
                    {isJobInputModalOpen ? (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Job
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedJobIds.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllVisible}
                    disabled={filteredJobs.length === 0 || selectedJobIds.length === filteredJobs.length}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (selectedJobIds.length === 0) return;
                      setShowBulkDeleteConfirm(true);
                    }}
                    disabled={selectedJobIds.length === 0}
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
                </>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search jobs by title, company, notes, skills..."
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {selectionMode && showBulkDeleteConfirm && (
            <div className="mb-4 max-w-xl">
              <JkConfirmDelete
                message={`Delete ${selectedJobIds.length} selected job${selectedJobIds.length === 1 ? '' : 's'}?`}
                onConfirm={handleConfirmBulkDelete}
                onCancel={() => setShowBulkDeleteConfirm(false)}
                isLoading={isBulkDeleting}
              />
            </div>
          )}

          {statusOptions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex flex-wrap items-center gap-2"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Filter className="h-4 w-4" />
                Filter:
              </div>
              <Button
                variant={selectedStatus === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus(null)}
                className={`gap-2 ${selectedStatus === null ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100' : ''}`}
              >
                All ({allJobs.length})
              </Button>
              {statusOptions.map((status) => (
                <Button
                  key={status.value}
                  variant={selectedStatus === status.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus(status.value)}
                  className={`gap-2 ${
                    selectedStatus === status.value
                      ? status.colorClass
                      : ''
                  }`}
                >
                  {status.label} ({statusCounts[status.value] ?? 0})
                </Button>
              ))}
            </motion.div>
          )}

          {/* Jobs Grid */}
          <JkJobsGrid onOpenTemplateSelector={handleOpenTemplateSelector} />

          <JkGap />
        </div>
      </div>
      <JkJobExpanded />
      
      {/* Template Selection Modal */}
      <JkTemplateSelector
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false);
          setSelectedJobForGeneration(null);
          setSelectedReferenceResumeId(null);
        }}
        type={templateSelectorType}
        onSelectTemplate={handleTemplateSelect}
        isGenerating={isGenerating}
        jobTitle={selectedJobForGeneration?.title}
        jobCompany={selectedJobForGeneration?.company}
        referenceResumes={(resumes || []).map((r: any) => ({
          id: r._id || r.id,
          name: r.name || 'Untitled Resume',
        }))}
        selectedReferenceResumeId={selectedReferenceResumeId}
        onSelectReferenceResume={setSelectedReferenceResumeId}
      />

      {/* Upgrade Modal */}
      <JkUpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() =>
          setUpgradeModal((prev) => ({ ...prev, isOpen: false }))
        }
        feature={upgradeModal.feature}
        currentLimit={upgradeModal.currentLimit}
        currentPlan={upgradeModal.currentPlan}
      />

      {/* Job Input Modal */}
      <JkJobInputModal
        isOpen={isJobInputModalOpen}
        onClose={() => setIsJobInputModalOpen(false)}
        onJobAdded={() => {
          // Jobs will automatically refresh via the provider
        }}
      />
    </div>
  );
}

