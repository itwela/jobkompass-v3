'use client';

import { api } from '@/convex/_generated/api';
import { useQuery, useMutation } from 'convex/react';
import React, { createContext, useCallback, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { Id } from "@/convex/_generated/dataModel";
import { useJobs } from './jkJobsProvider';

interface JobKompassResumeContextType {
  currentThemeName: string;
  setCurrentThemeName: (themeName: string) => void;

  currentJobForResumeCreation: any; 
  setCurrentJobForResumeCreation: (job: any) => void;

  complexFieldIndex: number;
  setComplexFieldIndex: (index: number) => void;
  complexFieldData: any;
  setComplexFieldData: (data: any) => void;
  readyToSaveComplexFields: boolean;
  setReadyToSaveComplexFields: (value: boolean) => void;

  customSymbol: any;
  setCustomSymbol: (symbol: any) => void;

  currentResumeId: string | null;
  setCurrentResumeId: (id: string) => void;

  resumes: any[] | undefined;
  resumeStats: Record<string, {
    totalJobs: number;
    offered: number;
    rejected: number;
    ghosted: number;
    applied: number;
    callback: number;
    interviewing: number;
  }>;
  resumePreferences: string[] | null | undefined;
  coverLetterStats: Record<string, {
    totalJobs: number;
    offered: number;
    rejected: number;
    ghosted: number;
    applied: number;
    callback: number;
    interviewing: number;
  }>;
  
  selectionMode: boolean;
  setSelectionMode: (enabled: boolean) => void;
  selectedResumeIds: string[];
  toggleResumeSelection: (id: string) => void;
  selectAllResumes: (ids?: string[]) => void;
  clearResumeSelection: () => void;
  bulkDeleteResumes: (ids?: string[]) => Promise<void>;
}

const ResumeContext = createContext<JobKompassResumeContextType | null>(null);

export function JobKompassResumeProvider({ children }: { children: React.ReactNode }) {

  const [currentThemeName, setCurrentThemeName] = useState<string>('Tech Bro');
  const [currentJobForResumeCreation, setCurrentJobForResumeCreation] = useState<any>(null);
  const [complexFieldIndex, setComplexFieldIndex] = useState<number>(0);
  const [complexFieldData, setComplexFieldData] = useState<any>(null);
  const [readyToSaveComplexFields, setReadyToSaveComplexFields] = useState<boolean>(false);
  const [customSymbol, setCustomSymbol] = useState<any>(null);

  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);

  // Get jobs from Jobs Provider
  const { allJobs } = useJobs();
  
  const resumes = useQuery(api.documents.listResumes);
  const coverLetters = useQuery(api.documents.listCoverLetters);
  const resumePreferences = useQuery(api.auth.getResumePreferences);

  console.log('resumes:', resumes);
  const deleteResumeMutation = useMutation(api.documents.deleteResume);
  
  // Calculate resume stats locally using jobs from Jobs Provider
  const resumeStats = useMemo(() => {
    if (!resumes || !allJobs) return {};
    
    const stats: Record<string, {
      totalJobs: number;
      offered: number;
      rejected: number;
      ghosted: number;
      applied: number;
      callback: number;
      interviewing: number;
    }> = {};
    
    for (const resume of resumes) {
      const resumeTitle = resume.name;
      if (!resumeTitle) continue;
      
      // Match jobs by resume name
      const matchingJobs = allJobs.filter((job) => {
        if (!job.resumeUsed) return false;
        
        const jobResumeName = job.resumeUsed.trim().toLowerCase();
        const resumeName = resume.name?.trim().toLowerCase();
        
        return jobResumeName === resumeName;
      });
      
      if (matchingJobs.length > 0) {
        stats[resumeTitle] = {
          totalJobs: 0,
          offered: 0,
          rejected: 0,
          ghosted: 0,
          applied: 0,
          callback: 0,
          interviewing: 0,
        };
        
        for (const job of matchingJobs) {
          stats[resumeTitle].totalJobs++;
          
          const status = job.status?.toLowerCase() || '';
          if (status === 'offered' || status === 'accepted') {
            stats[resumeTitle].offered++;
          } else if (status === 'rejected') {
            stats[resumeTitle].rejected++;
          } else if (status === 'ghosted' || status === 'no response') {
            stats[resumeTitle].ghosted++;
          } else if (status === 'applied') {
            stats[resumeTitle].applied++;
          } else if (status === 'callback') {
            stats[resumeTitle].callback++;
          } else if (status === 'interviewing') {
            stats[resumeTitle].interviewing++;
          }
        }
      }
    }
    
    return stats;
  }, [resumes, allJobs]);

  // Calculate cover letter stats locally using jobs from Jobs Provider
  const coverLetterStats = useMemo(() => {
    if (!coverLetters || !allJobs) return {};
    
    const stats: Record<string, {
      totalJobs: number;
      offered: number;
      rejected: number;
      ghosted: number;
      applied: number;
      callback: number;
      interviewing: number;
    }> = {};
    
    for (const coverLetter of coverLetters) {
      const coverLetterTitle = coverLetter.name;
      if (!coverLetterTitle) continue;
      
      // Match jobs by cover letter name
      const matchingJobs = allJobs.filter((job) => {
        if (!job.coverLetterUsed) return false;
        
        const jobCoverLetterName = job.coverLetterUsed.trim().toLowerCase();
        const clName = coverLetter.name?.trim().toLowerCase();
        
        return jobCoverLetterName === clName;
      });
      
      if (matchingJobs.length > 0) {
        stats[coverLetterTitle] = {
          totalJobs: 0,
          offered: 0,
          rejected: 0,
          ghosted: 0,
          applied: 0,
          callback: 0,
          interviewing: 0,
        };
        
        for (const job of matchingJobs) {
          stats[coverLetterTitle].totalJobs++;
          
          const status = job.status?.toLowerCase() || '';
          if (status === 'offered' || status === 'accepted') {
            stats[coverLetterTitle].offered++;
          } else if (status === 'rejected') {
            stats[coverLetterTitle].rejected++;
          } else if (status === 'ghosted' || status === 'no response') {
            stats[coverLetterTitle].ghosted++;
          } else if (status === 'applied') {
            stats[coverLetterTitle].applied++;
          } else if (status === 'callback') {
            stats[coverLetterTitle].callback++;
          } else if (status === 'interviewing') {
            stats[coverLetterTitle].interviewing++;
          }
        }
      }
    }
    
    return stats;
  }, [coverLetters, allJobs]);

  const [selectionMode, setSelectionModeState] = useState(false);
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>([]);
  const toggleResumeSelection = useCallback((id: string) => {
    setSelectedResumeIds((prev) =>
      prev.includes(id) ? prev.filter((resumeId) => resumeId !== id) : [...prev, id]
    );
  }, []);

  const selectAllResumes = useCallback((ids?: string[]) => {
    if (ids && ids.length > 0) {
      setSelectedResumeIds(ids);
      return;
    }
    if (!Array.isArray(resumes)) return;
    setSelectedResumeIds(resumes.map((resume: any) => String(resume._id ?? resume.id)));
  }, [resumes]);

  const clearResumeSelection = useCallback(() => {
    setSelectedResumeIds([]);
  }, []);

  const setSelectionMode = useCallback((enabled: boolean) => {
    setSelectionModeState(enabled);
    if (!enabled) {
      setSelectedResumeIds([]);
    }
  }, []);

  const bulkDeleteResumes = useCallback(
    async (ids?: string[]) => {
      const targetIds = (ids ?? selectedResumeIds).filter((resumeId): resumeId is string => Boolean(resumeId));
      if (targetIds.length === 0) return;

      try {
        await Promise.all(
          targetIds.map((resumeId) =>
            deleteResumeMutation({ resumeId: resumeId as Id<"resumes"> })
          )
        );
        if (currentResumeId && targetIds.includes(currentResumeId)) {
          setCurrentResumeId(null);
        }
        if (ids === undefined) {
          setSelectedResumeIds([]);
          setSelectionModeState(false);
        } else {
          setSelectedResumeIds((prev) =>
            prev.filter((resumeId) => !targetIds.includes(resumeId))
          );
        }
      } catch (error) {
        console.error("Failed to delete selected resumes:", error);
      }
    },
    [currentResumeId, deleteResumeMutation, selectedResumeIds]
  );


  // STUB -------- CALLBACKS



  // STUB -------- USEEFFECTS

  useEffect(() => {
  }, [])

  useEffect(() => {
    console.log('resumeStats:', resumeStats);
  }, [resumeStats]);

  const value = {

    currentThemeName,
    setCurrentThemeName,
    currentJobForResumeCreation, 
    setCurrentJobForResumeCreation,

    complexFieldIndex,
    setComplexFieldIndex,
    complexFieldData,
    setComplexFieldData,
    readyToSaveComplexFields,
    setReadyToSaveComplexFields,

    customSymbol,
    setCustomSymbol,

    currentResumeId,
    setCurrentResumeId,

    resumes,
    resumeStats,
    resumePreferences,
    coverLetterStats,
    selectionMode,
    setSelectionMode,
    selectedResumeIds,
    toggleResumeSelection,
    selectAllResumes,
    clearResumeSelection,
    bulkDeleteResumes,
    
  };

  return (
    <ResumeContext.Provider value={value}>
      {children}
    </ResumeContext.Provider>
  );
}

export default JobKompassResumeProvider;

export const useJobKompassResume = () => {
  const context = useContext(ResumeContext);
  if (!context) {
    throw new Error('useJobKompassResume must be used within a JobKompassResumeProvider');
  }
  return context;
};