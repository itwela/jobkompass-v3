'use client'

import { useState, MouseEvent, useEffect } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { useJobs } from "@/providers/jkJobsProvider";
import { Id } from "@/convex/_generated/dataModel";
import { motion } from "framer-motion";
import { ExternalLink, Calendar, Briefcase, Trash2, CheckCircle2, Circle, Sparkles, FileText, FileCheck } from "lucide-react";
import JkConfirmDelete from "../jkConfirmDelete";
import JkCompensationBadge from "../jkCompensationBadge";
import { TemplateType } from "../jkTemplateSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface JobCardProps {
  job: {
    _id: Id<"jobs">;
    company: string;
    title: string;
    link: string;
    status: string;
    compensation?: string;
    dateApplied?: string;
    createdAt: number;
    updatedAt: number;
    seenAt?: number;
  };
  index: number;
  onClick: () => void;
  onDelete: () => Promise<void>;
  isDeleting: boolean;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenTemplateSelector: (type: TemplateType, job: any) => void;
}

function JobCard({
  job,
  index,
  onClick,
  onDelete,
  isDeleting,
  selectionMode,
  selected,
  onToggleSelect,
  onOpenTemplateSelector,
}: JobCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localDeleting, setLocalDeleting] = useState(false);

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setShowDeleteConfirm(true);
  };

  useEffect(() => {
    if (selectionMode) {
      setShowDeleteConfirm(false);
      setLocalDeleting(false);
    }
  }, [selectionMode]);

  const handleConfirmDelete = async () => {
    setLocalDeleting(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
    } finally {
      setLocalDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleCardClick = () => {
    if (selectionMode) {
      onToggleSelect();
    } else {
      onClick();
    }
  };

  const statusColors: Record<string, string> = {
    Interested: 'bg-blue-100 text-blue-800 border-blue-200',
    Applied: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Interviewing: 'bg-purple-100 text-purple-800 border-purple-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    Offered: 'bg-green-100 text-green-800 border-green-200',
  };

  const statusColor = statusColors[job.status] || 'bg-gray-100 text-gray-800 border-gray-200';

  // Check if job is new (never seen)
  const isNew = !job.seenAt;

const handleGenerateResume = (event: MouseEvent) => {
    event.stopPropagation();
    onOpenTemplateSelector('resume', job);
  };

  const handleGenerateCoverLetter = (event: MouseEvent) => {
    event.stopPropagation();
    onOpenTemplateSelector('cover-letter', job);
  };

  const cardDetails = (
    <div className="mt-auto space-y-2">

      {job.dateApplied && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Applied {job.dateApplied}
        </div>
      )}

      {/* Compensation Badge */}
      <JkCompensationBadge compensation={job.compensation} />

      <div className="flex items-center gap-2 justify-between w-full">
        <a
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-blue-800 hover:text-blue-900 hover:underline"
        >
          View Job <ExternalLink className="h-3 w-3" />
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Generate
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={handleGenerateResume}>
              <FileText className="h-4 w-4 mr-2" />
              Resume
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGenerateCoverLetter}>
              <FileCheck className="h-4 w-4 mr-2" />
              Cover Letter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <BlurFade delay={0.0618 + index * 0.05} inView>
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="cursor-pointer"
        onClick={handleCardClick}
      >
        <div
          className={`bg-card border rounded-lg p-6 h-full min-h-[230px] flex flex-col hover:shadow-lg transition-shadow ${
            selectionMode && selected 
              ? 'border-blue-400 ring-2 ring-blue-200' 
              : isNew 
                ? 'border-primary border-2' 
                : 'border-border'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1 line-clamp-2">{job.title}</h3>
            </div>
            {selectionMode ? (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSelect();
                }}
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-100/40 transition-colors"
                aria-pressed={selected}
              >
                {selected ? (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </button>
            ) : (
              <button
                onClick={handleDeleteClick}
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Delete job"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2  mb-3 justify-between w-full">
                
                <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {job.company}
                </p>
                <div className={` px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
                  {job.status}
                </div>

          </div>

          {!selectionMode && showDeleteConfirm ? (
            <div
              className="mt-3"
              onClick={(event) => event.stopPropagation()}
            >
              <JkConfirmDelete
                onConfirm={() => {
                  void handleConfirmDelete();
                }}
                onCancel={handleCancelDelete}
                isLoading={isDeleting || localDeleting}
              />
            </div>
          ) : (
            cardDetails
          )}
        </div>
      </motion.div>
    </BlurFade>
  );
}

interface JkJobsGridProps {
  onOpenTemplateSelector?: (type: TemplateType, job: any) => void;
}

export default function JkJobsGrid({ onOpenTemplateSelector }: JkJobsGridProps = {}) {
  const {
    allJobs,
    filteredJobs,
    setSelectedJobId,
    isAuthenticated,
    authLoading,
    handleDeleteJob,
    selectionMode,
    toggleJobSelection,
    selectedJobIds,
    selectedStatus,
  } = useJobs();
  const [deletingId, setDeletingId] = useState<Id<"jobs"> | null>(null);
  const markJobAsSeen = useMutation(api.jobs.markJobAsSeen);

  const handleOpenTemplateSelectorInternal = (
    type: TemplateType,
    job: any,
  ) => {
    if (onOpenTemplateSelector) {
      onOpenTemplateSelector(type, job);
    }
  };

  const handleDelete = async (id: Id<"jobs">) => {
    setDeletingId(id);
    try {
      await handleDeleteJob(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-semibold mb-2">Sign in required</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Please sign in to view your applied jobs.
        </p>
      </div>
    );
  }

  if (allJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="text-6xl mb-4">💼</div>
        <h2 className="text-2xl font-semibold mb-2">No jobs yet</h2>
        <p className="text-muted-foreground mb-6">
          Jobs you apply to will appear here
        </p>
      </div>
    );
  }

  if (filteredJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-6">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-semibold mb-2">No jobs match this filter</h2>
        <p className="text-muted-foreground mb-4">
          {selectedStatus
            ? `Try choosing a different status, clearing search, or reset filters.`
            : `Try adjusting your filters or clearing the search.`}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[230px]">
      {filteredJobs.map((job, index) => (
        <JobCard
          key={job._id}
          job={job}
          index={index}
          onClick={async () => {
            setSelectedJobId(job._id);
            // Mark job as seen when clicked
            try {
              await markJobAsSeen({ jobId: job._id });
            } catch (error) {
              // Silently fail - don't interrupt user experience
              console.error('Failed to mark job as seen:', error);
            }
          }}
          onDelete={() => handleDelete(job._id)}
          isDeleting={deletingId === job._id}
          selectionMode={selectionMode}
          selected={selectedJobIds.includes(job._id)}
          onToggleSelect={() => toggleJobSelection(job._id)}
          onOpenTemplateSelector={handleOpenTemplateSelectorInternal}
        />
      ))}
    </div>
  );
}

