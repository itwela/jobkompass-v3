'use client'

import { useState, useEffect } from "react";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { useJobs } from "@/providers/jkJobsProvider";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { ChevronDown, ChevronUp, Radar, FileText, Briefcase, X, Check, Mail, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAppResumeTemplateOptions } from "@/lib/templates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function JkContextPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'resumes' | 'coverLetters' | 'jobs'>('resumes');
  const { resumes } = useJobKompassResume();
  const { coverLetterList } = useJobKompassDocuments();
  const { allJobs, statusOptions } = useJobs();
  const { 
    attachedResumeIds, 
    attachedCoverLetterIds,
    attachedJobIds, 
    addResumeAttachment, 
    removeResumeAttachment,
    addCoverLetterAttachment,
    removeCoverLetterAttachment,
    addJobAttachment,
    removeJobAttachment,
    selectedResumeTemplateId,
    setSelectedResumeTemplateId,
  } = useJobKompassChatWindow();

  // Close context panel when message is sent
  useEffect(() => {
    const handler = () => {
      setIsExpanded(false);
    };
    window.addEventListener('jk:sendChat', handler);
    return () => window.removeEventListener('jk:sendChat', handler);
  }, []);

  const resumesList = resumes || [];
  const coverLettersList = coverLetterList || [];
  const jobsList = allJobs || [];

  // Get status color class
  const getStatusColor = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.colorClass || "bg-gray-100 text-gray-800";
  };

  // Get current tab count for header
  const getTabCount = () => {
    switch (activeTab) {
      case 'resumes': return resumesList.length;
      case 'coverLetters': return coverLettersList.length;
      case 'jobs': return jobsList.length;
      default: return 0;
    }
  };

  if (!isExpanded) {
    return (
      <div className="w-full mb-2 bg-card">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between gap-2 bg-card/50 hover:bg-card"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Radar className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium truncate">
              Context ({resumesList.length} resumes, {coverLettersList.length} cover letters, {jobsList.length} jobs)
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full mb-2 rounded-2xl border border-border bg-card shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Context</h3>
          <span className="text-xs text-muted-foreground">
            ({getTabCount()} items)
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(false)}
          className="h-6 w-6"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Resume template for creation */}
      <div className="px-4 py-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 mb-1.5">
          <Layout className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Resume template for AI creation</span>
        </div>
        <Select
          value={selectedResumeTemplateId ?? ''}
          onValueChange={(v) => setSelectedResumeTemplateId(v || null)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select template (required for resume creation)" />
          </SelectTrigger>
          <SelectContent>
            {getAppResumeTemplateOptions().map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground mt-1">
          The AI will use this template when creating resumes. Select before asking to create.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('resumes')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'resumes'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Resumes</span> ({resumesList.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('coverLetters')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'coverLetters'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cover Letters</span> ({coverLettersList.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'jobs'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Jobs</span> ({jobsList.length})
          </div>
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="h-[200px]">
        <div className="p-3 space-y-2">
          {/* Resumes Tab */}
          {activeTab === 'resumes' && (
            resumesList.length > 0 ? (
              resumesList.map((resume: any) => {
                const isAttached = attachedResumeIds.includes(resume._id);
                return (
                  <div
                    key={resume._id}
                    onClick={() => {
                      if (isAttached) {
                        removeResumeAttachment(resume._id);
                      } else {
                        addResumeAttachment(resume._id);
                      }
                    }}
                    className={`
                      p-3 rounded-lg border transition-all cursor-pointer
                      ${isAttached 
                        ? 'border-primary bg-primary/10 hover:bg-primary/15' 
                        : 'border-border bg-background hover:bg-muted/50'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className={`h-4 w-4 shrink-0 ${isAttached ? 'text-primary' : 'text-muted-foreground'}`} />
                          <p className={`text-sm font-medium truncate ${isAttached ? 'text-primary' : ''}`}>
                            {resume.name || `Untitled ${resume._id.slice(-6)}`}
                          </p>
                        </div>
                        {resume.createdAt && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            Created: {new Date(resume.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {isAttached && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No resumes yet</p>
                <p className="text-xs mt-1">Create your first resume to get started</p>
              </div>
            )
          )}

          {/* Cover Letters Tab */}
          {activeTab === 'coverLetters' && (
            coverLettersList.length > 0 ? (
              coverLettersList.map((coverLetter: any) => {
                const isAttached = attachedCoverLetterIds.includes(coverLetter._id);
                return (
                  <div
                    key={coverLetter._id}
                    onClick={() => {
                      if (isAttached) {
                        removeCoverLetterAttachment(coverLetter._id);
                      } else {
                        addCoverLetterAttachment(coverLetter._id);
                      }
                    }}
                    className={`
                      p-3 rounded-lg border transition-all cursor-pointer
                      ${isAttached 
                        ? 'border-primary bg-primary/10 hover:bg-primary/15' 
                        : 'border-border bg-background hover:bg-muted/50'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Mail className={`h-4 w-4 shrink-0 ${isAttached ? 'text-primary' : 'text-muted-foreground'}`} />
                          <p className={`text-sm font-medium truncate ${isAttached ? 'text-primary' : ''}`}>
                            {coverLetter.name || `Untitled ${coverLetter._id.slice(-6)}`}
                          </p>
                        </div>
                        {coverLetter.createdAt && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            Created: {new Date(coverLetter.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {isAttached && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No cover letters yet</p>
                <p className="text-xs mt-1">Generate a cover letter using the AI chat</p>
              </div>
            )
          )}

          {/* Jobs Tab */}
          {activeTab === 'jobs' && (
            jobsList.length > 0 ? (
              jobsList.map((job: any) => {
                const isAttached = attachedJobIds.includes(job._id);
                return (
                  <div
                    key={job._id}
                    onClick={() => {
                      if (isAttached) {
                        removeJobAttachment(job._id);
                      } else {
                        addJobAttachment(job._id);
                      }
                    }}
                    className={`
                      p-3 rounded-lg border transition-all cursor-pointer
                      ${isAttached 
                        ? 'border-primary bg-primary/10 hover:bg-primary/15' 
                        : 'border-border bg-background hover:bg-muted/50'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Briefcase className={`h-4 w-4 shrink-0 ${isAttached ? 'text-primary' : 'text-muted-foreground'}`} />
                          <p className={`text-sm font-medium truncate ${isAttached ? 'text-primary' : ''}`}>{job.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6 mb-1">
                          {job.company}
                        </p>
                        <div className="flex items-center gap-2 ml-6">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                          {job.dateApplied && (
                            <span className="text-xs text-muted-foreground">
                              Applied: {job.dateApplied}
                            </span>
                          )}
                        </div>
                      </div>
                      {isAttached && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No jobs tracked yet</p>
                <p className="text-xs mt-1">Add jobs to track your applications</p>
              </div>
            )
          )}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          💡 Click items to attach them to your message • Attached items will be visible to the AI
        </p>
      </div>
    </div>
  );
}

