'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

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
  showHelperContainer: boolean;
  setShowHelperContainer: (value: boolean) => void;
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
  commands: string[];
  commandActions: string[];
  highlightedText: string | null;
  setHighlightedText: (text: string | null) => void;
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
    { id: '/resume', name: 'Resume Mode' },
    { id: '/file', name: 'File Mode' },
    { id: '/resources', name: 'Links & Resources' },
  ]);
  // STUB -----

  // NOTE - MODE STUFF
  const [startingMode, setStartingMode] = useState<ModeType>(allModes[0]);
  const [currentMode, setCurrentMode] = useState<ModeType>(startingMode);
  const [wantsTutorial, setWantsTutorial] = useState<boolean>(false);
  const [wantsToAddJob, setWantsToAddJob] = useState<boolean>(false);
  const [wantsToDownloadResume, setWantsToDownloadResume] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const [showHelperContainer, setShowHelperContainer] = useState<boolean>(false);
  
  // File mode state
  const [isFileMode, setIsFileMode] = useState<boolean>(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // NOTE - TEXT AREA STUFF
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [textValue, setTextValue] = React.useState('')
  const [dynamicTextAreaHeight, setDynamicTextAreaHeight] = React.useState(0)
  // STUB - STEP 2 OF ADDING A NEW MODE/ACTION
  const commands = ['/home', '/chat', '/resume', '/jobs', '/tutorial', '/file', '/resources']
  const commandActions = ['/add', '/download-resume', '/start']
  const allCommandsAndActions = [...commands, ...commandActions]
  // STUB -----
  const [highlightedText, setHighlightedText] = React.useState<string | null>(null)



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
        setShowHelperContainer(false);
        
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
        setShowHelperContainer(false);
      }

      if (actionsOnPress === '/download-resume') {
        setWantsToDownloadResume(true);
        setWantsTutorial(false);
        setWantsToAddJob(false);
        setShowHelperContainer(false);
      }

      if (actionsOnPress === '/start') {
        setWantsTutorial(true);
        setWantsToAddJob(false);
        setWantsToDownloadResume(false);
        setShowHelperContainer(false);
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

    // NOTE - Check for commands in text and switch modes
    if (!textValue) {
      // const homeMode = allModes.find(mode => mode.id === '/home')
      // if (homeMode) {
      //   setCurrentMode(homeMode)
      //   setWantsTutorial(false)
      // }
      // setHighlightedText(null)
    } else {
      const command = commands.find(cmd => textValue.startsWith(cmd));
      setHighlightedText(command || null);

      const actions = commandActions.find(cmd => textValue.startsWith(cmd));
      setHighlightedText(actions || null);

      // NOTE - IF HOME, CHAT, RESUME, JOBS, FILE
      if (command) {
        const modeId = command;
        const targetMode = allModes.find(mode => mode.id === modeId);
        if (targetMode) {
          setCurrentMode(targetMode);
          setWantsTutorial(false);
          setWantsToAddJob(false);
          setWantsToDownloadResume(false);
          setShowHelperContainer(false);
          
          // Handle file mode specifically
          if (modeId === '/file') {
            setIsFileMode(true);
          } else {
            setIsFileMode(false);
          }
        }
      }

      // NOTE -IF ADD, DOWNLOAD-RESUME, START
      // STUB - STEP 2.5 OF ADDING A NEW MODE/ACTION
      if (actions) {
        if (actions === '/add') {
          // set the mode to home first
          setCurrentMode(allModes[0]);

          setWantsToAddJob(true);

          setWantsTutorial(false);
          setWantsToDownloadResume(false);
          setShowHelperContainer(false);

        }

        if (actions === '/download-resume') {
          setWantsToDownloadResume(true);

          setWantsTutorial(false);
          setWantsToAddJob(false);
          setShowHelperContainer(false);
        }

        if (actions === '/start') {
          setWantsTutorial(true);

          setWantsToAddJob(false);
          setWantsToDownloadResume(false);
          setShowHelperContainer(false);
        }
      }
      // STUB -----

      if (textValue.startsWith('/')) {
        setShowHelperContainer(true)
      }
      if (textValue.startsWith('')) {
        setShowHelperContainer(true)
      }

    }

  }, [textValue, allModes, setCurrentMode])
  
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
    showHelperContainer,
    setShowHelperContainer,
    textValue,
    setTextValue,
    textareaRef,
    dynamicTextAreaHeight,
    setDynamicTextAreaHeight,
    commands,
    commandActions,
    highlightedText,
    setHighlightedText,
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