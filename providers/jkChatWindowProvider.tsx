'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Id } from "@/convex/_generated/dataModel";

export interface ModeType {
  id: string;
  name: string;
  command: string;
}

interface ModeContextType {
  allModes: ModeType[];
  setAllModes: (modes: ModeType[]) => void;
  startingMode: ModeType;
  setStartingMode: (mode: ModeType) => void;
  currentMode: ModeType;
  setCurrentMode: (mode: ModeType) => void;
}

interface ChatInteractionStateContextType {
  chatHistory: string[];
  setChatHistory: (history: string[]) => void;
  wantsToAddJob: boolean;
  setWantsToAddJob: (value: boolean) => void;
  wantsToDownloadResume: boolean;
  setWantsToDownloadResume: (value: boolean) => void;
  wantsHelp: boolean;
  setWantsHelp: (value: boolean) => void;
  allCommandsAndActions: string[];
  onClickAutoFill: (commandOrAction: string) => void;
  // File mode state
  isFileMode: boolean;
  setIsFileMode: (value: boolean) => void;
  droppedFile: File | null;
  setDroppedFile: (file: File | null) => void;
  fileName: string | null;
  setFileName: (name: string | null) => void;
  // Context attachments
  attachedResumeIds: Id<"resumes">[];
  setAttachedResumeIds: (ids: Id<"resumes">[]) => void;
  attachedCoverLetterIds: Id<"coverLetters">[];
  setAttachedCoverLetterIds: (ids: Id<"coverLetters">[]) => void;
  attachedJobIds: Id<"jobs">[];
  setAttachedJobIds: (ids: Id<"jobs">[]) => void;
  addResumeAttachment: (id: Id<"resumes">) => void;
  removeResumeAttachment: (id: Id<"resumes">) => void;
  addCoverLetterAttachment: (id: Id<"coverLetters">) => void;
  removeCoverLetterAttachment: (id: Id<"coverLetters">) => void;
  addJobAttachment: (id: Id<"jobs">) => void;
  removeJobAttachment: (id: Id<"jobs">) => void;
  clearAllAttachments: () => void;
  // File upload modal
  isFileModalOpen: boolean;
  setIsFileModalOpen: (open: boolean) => void;
}

interface InputControlContextType {
  textValue: string;
  setTextValue: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  dynamicTextAreaHeight: number;
  setDynamicTextAreaHeight: (height: number) => void;
  currentThreadId: Id<"threads"> | null;
  setCurrentThreadId: (id: Id<"threads"> | null) => void;
}

interface DynamicTextContextType {
  homeHeaderText: string[];
}

interface JobKompassChatWindowContextType extends ModeContextType, ChatInteractionStateContextType, InputControlContextType, DynamicTextContextType {}



const JobKompassChatWindowContext = createContext<JobKompassChatWindowContextType | null>(null);

export function JobKompassChatWindowProvider({ children }: { children: React.ReactNode }) {

  // STUB - STEP 1 OF ADDING A NEW MODE
  const [allModes, setAllModes] = useState<ModeType[]>([
    { id: '/home', name: 'Home', command: 'Home' },
    { id: '/help', name: 'Help', command: 'Help' },
    { id: '/chat', name: 'Chat', command: 'Chat' },
    { id: '/my-jobs', name: 'Jobs', command: 'Jobs' },
    { id: '/documents', name: 'Documents', command: 'Documents' },
    { id: '/resources', name: 'Links & Resources', command: 'Links & Resources' },
    { id: '/settings', name: 'Settings', command: 'Settings' },
  ]);
  // STUB -----

  // NOTE - MODE STUFF
  const [startingMode, setStartingMode] = useState<ModeType>(allModes[2]); // Chat Mode is default
  const [currentMode, setCurrentMode] = useState<ModeType>(startingMode);
  const [wantsHelp, setWantsHelp] = useState<boolean>(false);
  const [wantsToAddJob, setWantsToAddJob] = useState<boolean>(false);
  const [wantsToDownloadResume, setWantsToDownloadResume] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  
  // File mode state
  const [isFileMode, setIsFileMode] = useState<boolean>(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Context attachments state
  const [attachedResumeIds, setAttachedResumeIds] = useState<Id<"resumes">[]>([]);
  const [attachedCoverLetterIds, setAttachedCoverLetterIds] = useState<Id<"coverLetters">[]>([]);
  const [attachedJobIds, setAttachedJobIds] = useState<Id<"jobs">[]>([]);
  
  // File upload modal state
  const [isFileModalOpen, setIsFileModalOpen] = useState<boolean>(false);

  // Helper functions for managing attachments
  const addResumeAttachment = (id: Id<"resumes">) => {
    if (!attachedResumeIds.includes(id)) {
      setAttachedResumeIds([...attachedResumeIds, id]);
    }
  };

  const removeResumeAttachment = (id: Id<"resumes">) => {
    setAttachedResumeIds(attachedResumeIds.filter(resumeId => resumeId !== id));
  };

  const addCoverLetterAttachment = (id: Id<"coverLetters">) => {
    if (!attachedCoverLetterIds.includes(id)) {
      setAttachedCoverLetterIds([...attachedCoverLetterIds, id]);
    }
  };

  const removeCoverLetterAttachment = (id: Id<"coverLetters">) => {
    setAttachedCoverLetterIds(attachedCoverLetterIds.filter(clId => clId !== id));
  };

  const addJobAttachment = (id: Id<"jobs">) => {
    if (!attachedJobIds.includes(id)) {
      setAttachedJobIds([...attachedJobIds, id]);
    }
  };

  const removeJobAttachment = (id: Id<"jobs">) => {
    setAttachedJobIds(attachedJobIds.filter(jobId => jobId !== id));
  };

  const clearAllAttachments = () => {
    setAttachedResumeIds([]);
    setAttachedCoverLetterIds([]);
    setAttachedJobIds([]);
  };

  // NOTE - TEXT AREA STUFF
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [textValue, setTextValue] = React.useState('')
  const [dynamicTextAreaHeight, setDynamicTextAreaHeight] = React.useState(0)
  // STUB - STEP 2 OF ADDING A NEW MODE/ACTION
  const commands = ['/home', '/chat', '/documents', '/my-jobs', '/help', '/resources', '/settings']
  const commandActions: string[] = []
  const allCommandsAndActions = [...commands, ...commandActions]
  // STUB -----
  
  // Thread management
  const [currentThreadId, setCurrentThreadId] = React.useState<Id<"threads"> | null>(null)



  // NOTE - HEADER TEXT INFORMATION
  const homeHeaderText = [
    'Hey there!',
    'New to JobKompass? Type /start to get started!',
  ]

  const onClickAutoFill = (commandOrAction: string) => {
    const commandOnPress = commands.find(cmd => commandOrAction.startsWith(cmd));
    // TODO: COMMENT OUT FOR NOW
    // const actionsOnPress = commandActions.find(cmd => commandOrAction.startsWith(cmd));

    if (commandOnPress) {
      const modeId = commandOnPress;
      const targetMode = allModes.find(mode => mode.id === modeId);
      if (targetMode) {
        setCurrentMode(targetMode);
        setWantsHelp(false);
        setWantsToAddJob(false);
        setWantsToDownloadResume(false);
        
        // Handle file mode specifically
        if (modeId === '/file') {
          setIsFileMode(true);
        } else {
          setIsFileMode(false);
        }
      }
    }

    // TODO: COMMENT OUT FOR NOW
    // if (actionsOnPress) {
    //   if (actionsOnPress === '/add') {
    //     setCurrentMode(allModes[0]);
    //     setWantsToAddJob(true);
    //     setWantsHelp(false);
    //     setWantsToDownloadResume(false);
    //   }

    //   if (actionsOnPress === '/download-resume') {
    //     setWantsToDownloadResume(true);
    //     setWantsHelp(false);
    //     setWantsToAddJob(false);
    //   }

    //   if (actionsOnPress === '/start') {
    //     setWantsHelp(true);
    //     setWantsToAddJob(false);
    //     setWantsToDownloadResume(false);
    //   }
    // }
  }


  // NOTE - USE EFFECT TO SET DYNAMIC TEXT AREA HEIGHT AND MANAGE COMMANDS
  React.useEffect(() => {

    const textarea = textareaRef.current

    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 5 * 24);
      textarea.style.height = `${newHeight}px`;
      setDynamicTextAreaHeight(newHeight);
    }
  }, [textValue])
  
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
    wantsHelp,
    setWantsHelp,
    textValue,
    setTextValue,
    textareaRef,
    dynamicTextAreaHeight,
    setDynamicTextAreaHeight,
    homeHeaderText,
    allCommandsAndActions,
    onClickAutoFill,
    // File mode state
    isFileMode,
    setIsFileMode,
    droppedFile,
    setDroppedFile,
    fileName,
    setFileName,
    // Context attachments
    attachedResumeIds,
    setAttachedResumeIds,
    attachedCoverLetterIds,
    setAttachedCoverLetterIds,
    attachedJobIds,
    setAttachedJobIds,
    addResumeAttachment,
    removeResumeAttachment,
    addCoverLetterAttachment,
    removeCoverLetterAttachment,
    addJobAttachment,
    removeJobAttachment,
    clearAllAttachments,
    // Thread management
    currentThreadId,
    setCurrentThreadId,
    // File upload modal
    isFileModalOpen,
    setIsFileModalOpen,
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