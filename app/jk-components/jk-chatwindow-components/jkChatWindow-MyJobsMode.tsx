'use client'

import { useEffect, useState } from "react";
import { useJobs } from "@/providers/jkJobsProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, Filter, Search, X } from "lucide-react";
import { motion } from "framer-motion";
import JkJobsGrid from "./jkJobsGrid";
import JkJobExpanded from "./jkJobExpanded";
import JkConfirmDelete from "../jkConfirmDelete";
import JkGap from "../jkGap";
import JkTemplateSelectionModal, { DocumentType } from "../jkTemplateSelectionModal";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConvexAuth } from "convex/react";

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
  const [selectedJobForGeneration, setSelectedJobForGeneration] = useState<{
    id: Id<"jobs">;
    title: string;
    company: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { isAuthenticated: isAuth } = useConvexAuth();
  const user = useQuery(api.auth.currentUser, isAuth ? {} : "skip");
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const uploadResumeFile = useMutation(api.documents.uploadResumeFile);

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

  const handleGenerateDocument = (jobId: Id<"jobs">, jobTitle: string, jobCompany: string) => {
    setSelectedJobForGeneration({ id: jobId, title: jobTitle, company: jobCompany });
    setIsTemplateModalOpen(true);
  };

  // TODO: THE ACTUAL DOCUMENT GENERATION LOGIC IS HERE
  const handleTemplateSelect = async (documentType: DocumentType, templateId: string) => {
    if (!selectedJobForGeneration || !user) return;

    setIsGenerating(true);
    try {
      // Construct the message based on document type and template
      let message = '';
      if (documentType === 'resume') {
        message = `Generate a professional resume using the ${templateId} template for the position "${selectedJobForGeneration.title}" at "${selectedJobForGeneration.company}". Please create a tailored resume that highlights relevant skills and experience for this role.`;
      } else if (documentType === 'cover-letter') {
        message = `Generate a professional cover letter using the ${templateId} template for the position "${selectedJobForGeneration.title}" at "${selectedJobForGeneration.company}". Please create a personalized cover letter that demonstrates my interest and fit for this role.`;
      }

      // Call the chat API to generate the document
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          history: [],
          agentId: 'jobkompass',
          userId: user._id,
          username: user.username || user.email || undefined,
          contextJobIds: [selectedJobForGeneration.id],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read the streaming response and extract tool results
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let toolCallsData: any[] = [];
      let pdfBase64: string | null = null;
      let fileName: string | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'start' && data.toolCalls) {
                  toolCallsData = data.toolCalls;
                }
                if (data.type === 'done') {
                  break;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // Extract PDF from tool results if available
      // Note: The actual PDF data comes from the tool execution result
      // For now, we'll let the chat handle displaying it, and the user can download it
      // In a future enhancement, we could parse the full response to extract and save the PDF

      // Close modal after successful generation
      setIsTemplateModalOpen(false);
      setSelectedJobForGeneration(null);
      
      // Show success message
      // The generated document will appear in the chat, and the user can download it
      // TODO: In future, automatically save the PDF to documents section
    } catch (error) {
      console.error('Error generating document:', error);
      alert('Failed to generate document. Please try again.');
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
    <>
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
                <Button variant="outline" onClick={handleEnterSelectionMode}>
                  Multi-select
                </Button>
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
          <JkJobsGrid onGenerateDocument={handleGenerateDocument} />

          <JkGap />
        </div>
      </div>
      <JkJobExpanded />
      
      {/* Template Selection Modal */}
      <JkTemplateSelectionModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false);
          setSelectedJobForGeneration(null);
        }}
        // REVIEW: Template Selection
        onSelect={handleTemplateSelect}
        jobId={selectedJobForGeneration?.id}
        jobTitle={selectedJobForGeneration?.title}
        jobCompany={selectedJobForGeneration?.company}
      />
    </>
  );
}

