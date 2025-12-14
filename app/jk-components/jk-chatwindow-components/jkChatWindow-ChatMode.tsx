'use client'

import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { useAuth } from "@/providers/jkAuthProvider";
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { motion } from "framer-motion";
import JkGap from "../jkGap";
import { Check, Wrench, LogIn, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hand } from "lucide-react";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: Array<{
    name: string;
    arguments: any;
    result: any;
  }>;
  file?: {
    name: string;
    type: string;
    isImage: boolean;
  };
}

const easeOutCurve = [0.16, 1, 0.3, 1] as const;

const introWrapperVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: easeOutCurve,
      when: "beforeChildren",
      staggerChildren: 0.12,
    },
  },
};

const introChildVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: easeOutCurve,
    },
  },
};

const suggestionGridVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.25,
      staggerChildren: 0.08,
    },
  },
};

export default function JkCW_ChatMode() {
    const { 
        textValue, setTextValue, textareaRef, currentThreadId, setCurrentThreadId,
        attachedResumeIds, attachedJobIds, clearAllAttachments,
        droppedFile, setDroppedFile, fileName, setFileName, setIsFileMode
    } = useJobKompassChatWindow()
    const { user, isAuthenticated, isLoading: authLoading } = useAuth()
    
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Convex mutations
    const createThread = useMutation(api.threads.create)
    const addMessage = useMutation(api.threads.addMessage)

    // Load thread if one is selected
    const threadData = useQuery(
      api.threads.get,
      currentThreadId ? { threadId: currentThreadId } : "skip"
    )

    // Load messages when thread changes
    useEffect(() => {
        if (currentThreadId && threadData?.messages) {
            const loadedMessages: ChatMessage[] = threadData.messages.map((msg: any) => ({
                id: msg._id,
                type: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: new Date(msg.createdAt),
                toolCalls: msg.toolCalls,
            }))
            setMessages(loadedMessages)
        } else if (!currentThreadId) {
            // Clear messages when no thread is selected (shows new chat interface)
            setMessages([])
        }
    }, [threadData, currentThreadId])

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Send message function
    const sendMessage = async () => {
        if ((!textValue.trim() && !droppedFile) || isLoading || !isAuthenticated) return

        const currentTextValue = textValue.trim() // Capture the current value
        const currentFile = droppedFile // Capture current file
        const currentFileName = fileName // Capture current file name
        
        // Create or use existing thread
        let activeThreadId = currentThreadId
        if (!activeThreadId) {
            try {
                // Generate title from first message (truncate if too long)
                const title = currentTextValue.length > 50 
                    ? currentTextValue.slice(0, 50) + '...' 
                    : currentTextValue
                activeThreadId = await createThread({ title })
                setCurrentThreadId(activeThreadId)
            } catch (err) {
                console.error('Failed to create thread:', err)
                setError('Failed to create conversation')
                return
            }
        }

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: currentTextValue,
            timestamp: new Date(),
            file: currentFile ? {
                name: currentFile.name,
                type: currentFile.type,
                isImage: currentFile.type.startsWith('image/'),
            } : undefined,
        }

        setMessages(prev => [...prev, userMessage])
        setTextValue('')
        setIsLoading(true)
        setError(null)

        // Save user message to database
        try {
            await addMessage({
                threadId: activeThreadId,
                role: 'user',
                content: currentTextValue,
            })
        } catch (err) {
            console.error('Failed to save user message:', err)
        }

        // Create a placeholder assistant message that we'll update as we stream
        const tempMessageId = (Date.now() + 1).toString()
        const tempAssistantMessage: ChatMessage = {
            id: tempMessageId,
            type: 'assistant',
            content: '',
            timestamp: new Date()
        }
        setMessages(prev => [...prev, tempAssistantMessage])

        console.log('user', user)
        console.log('user._id', user?._id)

        // Convert file to base64 if present
        let fileData = null;
        if (currentFile) {
            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result as string;
                        // Remove data URL prefix to get just the base64 data
                        const base64Data = result.split(',')[1];
                        resolve(base64Data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(currentFile);
                });

                fileData = {
                    name: currentFile.name,
                    type: currentFile.type,
                    size: currentFile.size,
                    base64: base64,
                };
            } catch (err) {
                console.error('Failed to read file:', err);
                setError('Failed to read file');
                setIsLoading(false);
                return;
            }
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: currentTextValue,
                    file: fileData,
                    history: messages.map(msg => ({
                        role: msg.type === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    })),
                    agentId: 'jobkompass',
                    userId: user?._id,
                    username: user?.username || user?.email || undefined,
                    contextResumeIds: attachedResumeIds.length > 0 ? attachedResumeIds : undefined,
                    contextJobIds: attachedJobIds.length > 0 ? attachedJobIds : undefined,
                })
            })
            
            // Clear attachments immediately after sending
            clearAllAttachments()

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            // Handle streaming response
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let fullContent = ''
            let toolCallsData: any[] | undefined = undefined

            if (!reader) {
                throw new Error('No reader available')
            }

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6))
                        
                        if (data.type === 'start') {
                            // Update the message with metadata
                            toolCallsData = data.toolCalls
                            setMessages(prev => prev.map(msg => 
                                msg.id === tempMessageId 
                                    ? { ...msg, toolCalls: data.toolCalls }
                                    : msg
                            ))
                        } else if (data.type === 'token') {
                            // Append token to the message
                            fullContent += data.content
                            setMessages(prev => prev.map(msg => 
                                msg.id === tempMessageId 
                                    ? { ...msg, content: fullContent }
                                    : msg
                            ))
                        } else if (data.type === 'done') {
                            // Stream complete - save assistant message to database
                            setIsLoading(false)
                            
                            // Save assistant message to database
                            if (activeThreadId && fullContent) {
                                try {
                                    await addMessage({
                                        threadId: activeThreadId,
                                        role: 'assistant',
                                        content: fullContent,
                                        toolCalls: toolCallsData,
                                    })
                                } catch (err) {
                                    console.error('Failed to save assistant message:', err)
                                }
                            }
                        }
                    }
                }
            }
            
            // Clear file from input after response is complete
            if (currentFile) {
                setDroppedFile(null)
                setFileName(null)
                setIsFileMode(false)
            }
        } catch (err) {
            console.error('Chat error:', err)
            setError(err instanceof Error ? err.message : 'An error occurred')
            setIsLoading(false)
            // Remove the temp message on error
            setMessages(prev => prev.filter(msg => msg.id === tempMessageId))
            
            // Clear file on error too
            if (currentFile) {
                setDroppedFile(null)
                setFileName(null)
                setIsFileMode(false)
            }
        }
    }

    // Listen for global send event from input section
    useEffect(() => {
        const handler = () => {
            void sendMessage();
        };
        window.addEventListener('jk:sendChat', handler as EventListener);
        return () => window.removeEventListener('jk:sendChat', handler as EventListener);
    }, [textValue, messages]);

    // Clear chat - start a new thread
    const clearChat = () => {
        setMessages([])
        setError(null)
        setCurrentThreadId(null) // This will start a new thread on next message
    }

    // Handle suggestion click
    const handleSuggestionClick = (suggestion: string) => {
        setTextValue(suggestion)
        // Focus the textarea
        if (textareaRef.current) {
            textareaRef.current.focus()
        }
    }

    // Chat suggestions
    const suggestions = [
        "Help me find jobs I'm actually qualified for",
        "Improve my resume for a specific job posting",
        "Write a cover letter that doesn't sound generic",
        "Draft a follow-up message to the recruiter or hiring manager",
        "Prepare me for an interview for this role",
        "Tell me what I should be doing next in my job search"
    ]

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
                            Please sign in to use the chat feature. Click the JobKompass icon in the sidebar to sign in.
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
        <div className="flex flex-col h-full">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto chat-scroll">
                <div className="max-w-3xl mx-auto px-6 py-6 w-full">
                {messages.length === 0 ? (
                    <motion.div
                        className="flex flex-col items-center justify-center min-h-[60vh] text-center"
                        initial="hidden"
                        animate="visible"
                        variants={introWrapperVariants}
                    >
                        <motion.div className="text-3xl font-semibold mb-3 flex items-start gap-1 justify-center" variants={introChildVariants}>
                            <Hand className="h-8 w-8 inline-block mr-2" /> Hi! I'm JobKompass, your AI career assistant
                        </motion.div>
                        <motion.div className="text-muted-foreground mb-8" variants={introChildVariants}>
                            I can help you create resumes, analyze your career, and provide job search guidance.
                        </motion.div>
                        <motion.div
                            className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl w-full"
                            initial="hidden"
                            animate="visible"
                            variants={suggestionGridVariants}
                        >
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-4 py-3 text-left text-sm rounded-xl border border-border hover:bg-accent hover:border-border/50 transition-all duration-150 text-foreground hover:shadow-sm"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </motion.div>
                    </motion.div>
                ) : (
                    <div className="space-y-6 w-full">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`
                                    flex gap-3 w-full message-fade-in
                                    ${message.type === 'user' ? 'flex-row-reverse' : ''}
                                `}
                            >
                                <div className={`
                                    max-w-[85%]
                                    ${message.type === 'user' 
                                        ? 'bg-primary text-primary-foreground border border-primary rounded-2xl px-4 py-3' 
                                        : 'bg-card px-6 py-4'
                                    }
                                `}>
                                    {/* File Indicator for User Messages */}
                                    {message.type === 'user' && message.file && (
                                        <div className="mb-2 pb-2 border-b border-primary-foreground/20">
                                            <div className="flex items-center gap-2 text-xs opacity-90">
                                                {message.file.isImage ? (
                                                    <>
                                                        <FileText className="h-3 w-3" />
                                                        <span>🖼️ Image: {message.file.name}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileText className="h-3 w-3" />
                                                        <span>📄 File: {message.file.name}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className={message.type === 'assistant' ? 'markdown-content' : ''}>
                                        {message.type === 'assistant' ? (
                                            <ReactMarkdown>{message.content}</ReactMarkdown>
                                        ) : (
                                            <p className="leading-relaxed">{message.content}</p>
                                        )}
                                    </div>
                            
                                    {/* File Downloads Section - Check for PDF results first */}
                                    {message.toolCalls && message.toolCalls.length > 0 && (() => {
                                        // Extract all PDF results from tool calls
                                        const pdfResults = message.toolCalls.map((tool, index) => {
                                            const resultObj: any = tool?.result || {};
                                            
                                            // Check multiple possible paths for the PDF data
                                            let pdfBase64: string | undefined;
                                            let fileName: string | undefined;
                                            
                                            // Direct properties
                                            if (resultObj?.pdfBase64) {
                                                pdfBase64 = resultObj.pdfBase64;
                                                fileName = resultObj.fileName;
                                            }
                                            // Nested in output
                                            else if (resultObj?.output?.pdfBase64) {
                                                pdfBase64 = resultObj.output.pdfBase64;
                                                fileName = resultObj.output.fileName;
                                            }
                                            // Nested in data
                                            else if (resultObj?.data?.pdfBase64) {
                                                pdfBase64 = resultObj.data.pdfBase64;
                                                fileName = resultObj.data.fileName;
                                            }
                                            // Check if result is a string that might contain JSON
                                            else if (typeof resultObj === 'string') {
                                                try {
                                                    const parsed = JSON.parse(resultObj);
                                                    if (parsed?.pdfBase64) {
                                                        pdfBase64 = parsed.pdfBase64;
                                                        fileName = parsed.fileName;
                                                    }
                                                } catch (e) {
                                                    // Not JSON, ignore
                                                }
                                            }
                                            // Check if result.text contains JSON (like in your example)
                                            else if (resultObj?.text) {
                                                try {
                                                    const parsed = JSON.parse(resultObj.text);
                                                    if (parsed?.pdfBase64) {
                                                        pdfBase64 = parsed.pdfBase64;
                                                        fileName = parsed.fileName;
                                                    }
                                                } catch (e) {
                                                    // Not JSON, ignore
                                                }
                                            }
                                            
                                            return {
                                                toolName: tool.name,
                                                index,
                                                pdfBase64,
                                                fileName: fileName || 'resume.pdf',
                                                hasPdf: Boolean(pdfBase64)
                                            };
                                        }).filter(result => result.hasPdf);

                                        return (
                                            <>
                                                {/* Prominent File Downloads Section */}
                                                {pdfResults.length > 0 && (
                                                    <div className="bg-background border-2 border-blue-200 rounded-xl p-4 my-2">
                                                        <div className="font-bold text-foreground mb-2 flex items-center gap-2">
                                                            📁 Generated Files - Ready to Download
                                                        </div>
                                                        {pdfResults.map((result, idx) => (
                                                            <div key={idx} className="bg-card border border-border rounded-lg p-2 mb-1 last:mb-0 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xl">📄</span>
                                                                    <div>
                                                                        <div className="font-medium text-foreground text-sm">
                                                                            {result.fileName}
                                                                        </div>
                                                                        <div className="text-muted-foreground text-xs">
                                                                            Generated by {result.toolName}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <a
                                                                    href={`data:application/pdf;base64,${result.pdfBase64}`}
                                                                    download={result.fileName}
                                                                    className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium no-underline hover:opacity-80 transition-opacity"
                                                                >
                                                                    Download PDF
                                                                </a>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {/* Tool Calls Details - Collapsible */}
                                                <div 
                                                    className="bg-muted/30 rounded-lg mt-1 text-sm transition-all duration-200 overflow-hidden group"
                                                    onMouseEnter={() => {
                                                        if (window.innerWidth >= 768) {
                                                            setExpandedTools(prev => new Set(prev).add(message.id))
                                                        }
                                                    }}
                                                    onMouseLeave={() => {
                                                        if (window.innerWidth >= 768) {
                                                            setExpandedTools(prev => {
                                                                const next = new Set(prev)
                                                                next.delete(message.id)
                                                                return next
                                                            })
                                                        }
                                                    }}
                                                    onClick={() => {
                                                        if (window.innerWidth < 768) {
                                                            setExpandedTools(prev => {
                                                                const next = new Set(prev)
                                                                if (next.has(message.id)) {
                                                                    next.delete(message.id)
                                                                } else {
                                                                    next.add(message.id)
                                                                }
                                                                return next
                                                            })
                                                        }
                                                    }}
                                                >
                                                    {/* Collapsed State - Sleek Header */}
                                                    <div className="px-2 py-1.5 flex items-center gap-1.5 cursor-pointer">
                                                        <Wrench className="size-3.5 text-muted-foreground" />
                                                        <span className="text-xs font-medium text-muted-foreground">Tools Used</span>
                                                        <div className="flex-1 h-px bg-border/50 ml-1.5"></div>
                                                    </div>
                                                    
                                                    {/* Expanded Content */}
                                                    <div 
                                                        className={`px-2 pb-2 pt-0 space-y-1.5 transition-all duration-200 ease-in-out ${
                                                            expandedTools.has(message.id) 
                                                                ? 'opacity-100 max-h-[500px]' 
                                                                : 'opacity-0 max-h-0 overflow-hidden'
                                                        }`}
                                                    >
                                                        {message.toolCalls.map((tool, index) => (
                                                            <div key={index} className="pt-1.5 border-t border-border/30 first:border-t-0 first:pt-0">
                                                                <strong className="text-xs font-semibold text-foreground">{tool.name}</strong>
                                                                <div className="text-xs mt-0.5 flex items-center gap-1 text-muted-foreground">
                                                                    <Check className="size-3 text-green-500" /> Completed successfully
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                    {/* Loading Indicator */}
                    {isLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground px-6 py-3 typing-indicator">
                            🤖 JobKompass is thinking...
                        </div>
                    )}
                    
                    {/* Error Message */}
                    {error && (
                        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-sm">
                            ❌ {error}
                        </div>
                    )}
                    
                    <JkGap />

                    <div ref={messagesEndRef} />

                </div>
            </div>
        </div>
    )
}