'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Id } from "@/convex/_generated/dataModel";

export interface ModeType {
  id: string;
  name: string;
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
  wantsTutorial: boolean;
  setWantsTutorial: (value: boolean) => void;
  allCommandsAndActions: string[];
  onClickAutoFill: (commandOrAction: string) => void;
  // File mode state
  isFileMode: boolean;
  setIsFileMode: (value: boolean) => void;
  droppedFile: File | null;
  setDroppedFile: (file: File | null) => void;
  fileName: string | null;
  setFileName: (name: string | null) => void;
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
    { id: '/home', name: 'Home Mode' },
    { id: '/tutorial', name: 'Tutorial Mode' },
    { id: '/chat', name: 'Chat Mode' },
    { id: '/jobs', name: 'Jobs Mode' },
    { id: '/my-jobs', name: 'My Jobs' },
    { id: '/resume', name: 'Resume Mode' },
    { id: '/resume-editor', name: 'Resume Editor' },
    { id: '/file', name: 'File Mode' },
    { id: '/resources', name: 'Links & Resources' },
  ]);
  // STUB -----

  // NOTE - MODE STUFF
  const [startingMode, setStartingMode] = useState<ModeType>(allModes[2]); // Chat Mode is default
  const [currentMode, setCurrentMode] = useState<ModeType>(startingMode);
  const [wantsTutorial, setWantsTutorial] = useState<boolean>(false);
  const [wantsToAddJob, setWantsToAddJob] = useState<boolean>(false);
  const [wantsToDownloadResume, setWantsToDownloadResume] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  
  // File mode state
  const [isFileMode, setIsFileMode] = useState<boolean>(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // NOTE - TEXT AREA STUFF
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [textValue, setTextValue] = React.useState('')
  const [dynamicTextAreaHeight, setDynamicTextAreaHeight] = React.useState(0)
  // STUB - STEP 2 OF ADDING A NEW MODE/ACTION
  const commands = ['/home', '/chat', '/resume', '/resume-editor', '/jobs', '/my-jobs', '/tutorial', '/file', '/resources']
  const commandActions = ['/add', '/download-resume', '/start']
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
    const actionsOnPress = commandActions.find(cmd => commandOrAction.startsWith(cmd));

    if (commandOnPress) {
      const modeId = commandOnPress;
      const targetMode = allModes.find(mode => mode.id === modeId);
      if (targetMode) {
        setCurrentMode(targetMode);
        setWantsTutorial(false);
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

    if (actionsOnPress) {
      if (actionsOnPress === '/add') {
        setCurrentMode(allModes[0]);
        setWantsToAddJob(true);
        setWantsTutorial(false);
        setWantsToDownloadResume(false);
      }

      if (actionsOnPress === '/download-resume') {
        setWantsToDownloadResume(true);
        setWantsTutorial(false);
        setWantsToAddJob(false);
      }

      if (actionsOnPress === '/start') {
        setWantsTutorial(true);
        setWantsToAddJob(false);
        setWantsToDownloadResume(false);
      }
    }
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
    wantsTutorial,
    setWantsTutorial,
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
    // Thread management
    currentThreadId,
    setCurrentThreadId,
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