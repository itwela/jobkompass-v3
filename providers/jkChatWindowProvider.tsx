'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ModeType {
  id: string;
  name: string;
}

interface JobKompassChatWindowContextType {
  allModes: ModeType[];
  setAllModes: (modes: ModeType[]) => void;
  startingMode: ModeType;
  setStartingMode: (mode: ModeType) => void;
  currentMode: ModeType;
  setCurrentMode: (mode: ModeType) => void;
  chatHistory: string[];
  setChatHistory: (history: string[]) => void;
  wantsToAddJob: boolean;
  setWantsToAddJob: (value: boolean) => void;
  wantsToDownloadResume: boolean;
  setWantsToDownloadResume: (value: boolean) => void;
  wantsTutorial: boolean;
  setWantsTutorial: (value: boolean) => void;
}



const JobKompassChatWindowContext = createContext<JobKompassChatWindowContextType | null>(null);

export function JobKompassChatWindowProvider({ children }: { children: React.ReactNode }) {

  const [allModes, setAllModes] = useState<ModeType[]>([
    { id: '/home', name: 'Home Mode' },
    { id: '/chat', name: 'Chat Mode' },
    { id: '/jobs', name: 'Jobs Mode' },
    { id: '/resume', name: 'Resume Mode' },
  ]);
  const [startingMode, setStartingMode] = useState<ModeType>(allModes[0]);
  const [currentMode, setCurrentMode] = useState<ModeType>(startingMode);
  const [wantsTutorial, setWantsTutorial] = useState<boolean>(false);
  const [wantsToAddJob, setWantsToAddJob] = useState<boolean>(false);
  const [wantsToDownloadResume, setWantsToDownloadResume] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<string[]>([]);

  useEffect(() => {
    if (currentMode) {
      // Update the current mode when it changes
      console.log('Mode changed to:', currentMode.name);
      // Add any additional logic needed when mode changes
    }
  }, [currentMode]);
  
  const value = {
    allModes,
    setAllModes,
    startingMode,
    setStartingMode,
    currentMode,
    setCurrentMode,
    chatHistory,
    setChatHistory,
    wantsToAddJob,
    setWantsToAddJob,
    wantsToDownloadResume,
    setWantsToDownloadResume,
    wantsTutorial,
    setWantsTutorial,
  };

  return (
    <JobKompassChatWindowContext.Provider value={value}>
        {children}
    </JobKompassChatWindowContext.Provider>
  );
}

export const useJobKompassChatWindow = () => {
  const context = useContext(JobKompassChatWindowContext);
  if (!context) {
    throw new Error('useJobKompassChatWindow must be used within a JobKompassChatWindowProvider');
  }
  return context;
};