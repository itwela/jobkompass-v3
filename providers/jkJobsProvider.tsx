'use client'

import { createContext, useContext, ReactNode, useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/providers/jkAuthProvider";
import { Id } from "@/convex/_generated/dataModel";

interface Job {
  _id: Id<"jobs">;
  company: string;
  title: string;
  link: string;
  status: string;
  keywords?: string[];
  skills?: string[];
  description?: string;
  dateApplied?: string;
  interviewed?: boolean;
  easyApply?: string;
  resumeUsed?: string;
  coverLetterUsed?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

interface JobsContextType {
  // Data
  jobs: Job[] | null | undefined;
  allJobs: Job[];
  filteredJobs: Job[];
  availableStatuses: string[];
  statusCounts: Record<string, number>;
  selectedStatus: string | null;
  setSelectedStatus: (status: string | null) => void;
  statusOptions: JobStatusOption[];
  
  // State
  selectedJobId: Id<"jobs"> | null;
  setSelectedJobId: (id: Id<"jobs"> | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  
  // Actions
  handleAddJob: (data: {
    company: string;
    title: string;
    link: string;
    status: string;
    keywords?: string[];
    skills?: string[];
    description?: string;
    dateApplied?: string;
    interviewed?: boolean;
    easyApply?: string;
    resumeUsed?: string;
    coverLetterUsed?: string;
    notes?: string;
  }) => Promise<Id<"jobs"> | null>;
  handleUpdateJob: (id: Id<"jobs">, data: Partial<{
    company: string;
    title: string;
    link: string;
    status: string;
    keywords?: string[];
    skills?: string[];
    description?: string;
    dateApplied?: string;
    interviewed?: boolean;
    easyApply?: string;
    resumeUsed?: string;
    coverLetterUsed?: string;
    notes?: string;
  }>) => Promise<void>;
  handleDeleteJob: (id: Id<"jobs">) => Promise<void>;
  handleBulkDeleteJobs: (ids?: Id<"jobs">[]) => Promise<void>;
  toggleJobSelection: (id: Id<"jobs">) => void;
  selectAllJobs: (jobIds?: Id<"jobs">[]) => void;
  clearJobSelection: () => void;
  setJobSelection: (jobIds: Id<"jobs">[]) => void;
  selectedJobIds: Id<"jobs">[];
  selectionMode: boolean;
  setSelectionMode: (enabled: boolean) => void;
  
  // Auth
  isAuthenticated: boolean;
  authLoading: boolean;
  user: any;
}

interface JobStatusOption {
  value: string;
  label: string;
  colorClass: string;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

export function JkJobsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const jobs = useQuery(api.jobs.list, isAuthenticated ? {} : "skip");
  const addJob = useMutation(api.jobs.add);
  const updateJob = useMutation(api.jobs.update);
  const deleteJob = useMutation(api.jobs.remove);

  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionModeState] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Id<"jobs">[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Handle the jobs safely - it will be undefined when loading or an array when loaded
  // Sort by updatedAt in descending order (most recently updated first)
  const allJobs = useMemo(() => {
    return (jobs && Array.isArray(jobs)) 
      ? [...jobs].sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  }, [jobs]);
  
  const toggleJobSelection = useCallback((id: Id<"jobs">) => {
    setSelectedJobIds((prev) =>
      prev.includes(id) ? prev.filter((jobId) => jobId !== id) : [...prev, id]
    );
  }, []);

  const statusOptions: JobStatusOption[] = [
    { value: "Interested", label: "Interested", colorClass: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100" },
    { value: "Applied", label: "Applied", colorClass: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100" },
    { value: "Interviewing", label: "Interviewing", colorClass: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100" },
    { value: "Offered", label: "Offered", colorClass: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" },
    { value: "Rejected", label: "Rejected", colorClass: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100" },
    { value: "Ghosted", label: "Ghosted", colorClass: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100" },
  ];

  const availableStatuses = useMemo(
    () => statusOptions.map((option) => option.value),
    []
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allJobs.forEach((job) => {
      if (job.status) {
        counts[job.status] = (counts[job.status] ?? 0) + 1;
      }
    });
    return counts;
  }, [allJobs]);

  const filteredJobs = useMemo(() => {
    if (!selectedStatus) return allJobs;
    return allJobs.filter((job) => job.status === selectedStatus);
  }, [allJobs, selectedStatus]);

  const selectAllJobs = useCallback((jobIds?: Id<"jobs">[]) => {
    if (jobIds && jobIds.length > 0) {
      setSelectedJobIds(jobIds);
      return;
    }
    setSelectedJobIds(allJobs.map((job) => job._id));
  }, [allJobs]);

  const clearJobSelection = useCallback(() => {
    setSelectedJobIds([]);
  }, []);

  const setJobSelection = useCallback((jobIds: Id<"jobs">[]) => {
    setSelectedJobIds(jobIds);
  }, []);

  const setSelectionMode = useCallback((enabled: boolean) => {
    setSelectionModeState(enabled);
    if (!enabled) {
      setSelectedJobIds([]);
    }
  }, []);
  
  const handleAddJob = async (data: {
    company: string;
    title: string;
    link: string;
    status: string;
    keywords?: string[];
    skills?: string[];
    description?: string;
    dateApplied?: string;
    interviewed?: boolean;
    easyApply?: string;
    resumeUsed?: string;
    coverLetterUsed?: string;
    notes?: string;
  }) => {
    if (!isAuthenticated) {
      setError('Please sign in to add jobs');
      return null;
    }
    
    try {
      setError(null);
      const newId = await addJob(data);
      return newId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job. Please sign in.');
      return null;
    }
  };

  const handleUpdateJob = async (id: Id<"jobs">, data: Partial<{
    company: string;
    title: string;
    link: string;
    status: string;
    keywords?: string[];
    skills?: string[];
    description?: string;
    dateApplied?: string;
    interviewed?: boolean;
    easyApply?: string;
    resumeUsed?: string;
    coverLetterUsed?: string;
    notes?: string;
  }>) => {
    try {
      setError(null);
      await updateJob({ id, ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job. Please try again.');
    }
  };

  const handleDeleteJob = async (id: Id<"jobs">) => {
    try {
      setError(null);
      await deleteJob({ id });
      if (selectedJobId === id) {
        setSelectedJobId(null);
      }
      setSelectedJobIds((prev) => prev.filter((jobId) => jobId !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job. Please try again.');
    }
  };

  const handleBulkDeleteJobs = async (ids?: Id<"jobs">[]) => {
    const targetIds = (ids ?? selectedJobIds).filter(
      (jobId): jobId is Id<"jobs"> => Boolean(jobId)
    );
    if (targetIds.length === 0) {
      return;
    }
    try {
      setError(null);
      await Promise.all(targetIds.map((jobId) => deleteJob({ id: jobId })));
      if (selectedJobId && targetIds.includes(selectedJobId)) {
        setSelectedJobId(null);
      }
      setSelectedJobIds([]);
      setSelectionModeState(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete selected jobs. Please try again.');
    }
  };

  const value: JobsContextType = {
    // Data
    jobs,
    allJobs,
    filteredJobs,
    availableStatuses,
    statusCounts,
    selectedStatus,
    setSelectedStatus,
    statusOptions,
    
    // State
    selectedJobId,
    setSelectedJobId,
    error,
    setError,
    
    // Actions
    handleAddJob,
    handleUpdateJob,
    handleDeleteJob,
    handleBulkDeleteJobs,
    toggleJobSelection,
    selectAllJobs,
    clearJobSelection,
    setJobSelection,
    selectedJobIds,
    selectionMode,
    setSelectionMode,
    
    // Auth
    isAuthenticated,
    authLoading,
    user,
  };

  return (
    <JobsContext.Provider value={value}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobsContext);
  if (!context) {
    throw new Error('useJobs must be used within JkJobsProvider');
  }
  return context;
}

