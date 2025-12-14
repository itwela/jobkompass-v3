'use client'

import { useState, useEffect } from "react";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useJobs } from "@/providers/jkJobsProvider";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { ChevronDown, ChevronUp, FileText, Briefcase, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function JkContextPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'resumes' | 'jobs'>('resumes');
  const { resumes } = useJobKompassResume();
  const { allJobs, statusOptions } = useJobs();
  const { 
    attachedResumeIds, 
    attachedJobIds, 
    addResumeAttachment, 
    removeResumeAttachment,
    addJobAttachment,
    removeJobAttachment
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
  const jobsList = allJobs || [];

  // Get status color class
  const getStatusColor = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.colorClass || "bg-gray-100 text-gray-800";
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
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">
              Context ({resumesList.length} resumes, {jobsList.length} jobs)
            </span>
          </div>
          <ChevronDown className="h-4 w-4" />
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
            ({activeTab === 'resumes' ? resumesList.length : jobsList.length} items)
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

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('resumes')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'resumes'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText className="h-4 w-4" />
            Resumes ({resumesList.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'jobs'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Briefcase className="h-4 w-4" />
            Jobs ({jobsList.length})
          </div>
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="h-[200px]">
        <div className="p-3 space-y-2">
          {activeTab === 'resumes' ? (
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
                            Resume - {resume.name || `Untitled ${resume._id.slice(-6)}`}
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
          ) : (
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

