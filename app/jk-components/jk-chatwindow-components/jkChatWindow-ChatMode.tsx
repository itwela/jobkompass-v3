'use client'

import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

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
}

export default function JkCW_ChatMode() {
    const { textValue, setTextValue, textareaRef } = useJobKompassChatWindow()
    
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Send message function
    const sendMessage = async () => {
        if (!textValue.trim() || isLoading) return

        const currentTextValue = textValue.trim() // Capture the current value
        
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: currentTextValue,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setTextValue('')
        setIsLoading(true)
        setError(null)

        // Create a placeholder assistant message that we'll update as we stream
        const tempMessageId = (Date.now() + 1).toString()
        const tempAssistantMessage: ChatMessage = {
            id: tempMessageId,
            type: 'assistant',
            content: '',
            timestamp: new Date()
        }
        setMessages(prev => [...prev, tempAssistantMessage])

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: currentTextValue,
                    history: messages.map(msg => ({
                        role: msg.type === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    })),
                    agentId: 'jobkompass'
                })
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            // Handle streaming response
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let fullContent = ''

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
                            // Stream complete
                            setIsLoading(false)
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Chat error:', err)
            setError(err instanceof Error ? err.message : 'An error occurred')
            setIsLoading(false)
            // Remove the temp message on error
            setMessages(prev => prev.filter(msg => msg.id !== tempMessageId))
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

    // Clear chat
    const clearChat = () => {
        setMessages([])
        setError(null)
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
        "Help me create a professional resume",
        "Analyze my career path",
        "What skills should I add to my resume?",
        "How can I improve my job search?",
        "Create a cover letter for a software engineer position",
        "What are the latest job market trends?"
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto chat-scroll">
                <div className="max-w-3xl mx-auto px-6 py-6 w-full">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div className="text-3xl font-semibold mb-3">
                            👋 Hi! I'm JobKompass, your AI career assistant
                        </div>
                        <div className="text-muted-foreground mb-8">
                            I can help you create resumes, analyze your career, and provide job search guidance.
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl w-full">
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-4 py-3 text-left text-sm rounded-xl border border-border hover:bg-accent hover:border-border/50 transition-all duration-150 text-foreground hover:shadow-sm"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
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
                                    max-w-[85%] rounded-2xl px-4 py-3
                                    ${message.type === 'user' 
                                        ? 'bg-primary text-primary-foreground' 
                                        : 'bg-muted text-foreground border border-border'
                                    }
                                `}>
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
                                                    <div className="bg-background border-2 border-primary rounded-xl p-4 my-2">
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
                                                                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium no-underline hover:opacity-80 transition-opacity"
                                                                >
                                                                    Download PDF
                                                                </a>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {/* Tool Calls Details */}
                                                <div className="bg-muted/50 p-2 rounded-lg mt-1 text-sm">
                                                    <div className="font-medium text-foreground mb-0.5">
                                                        🔧 Tools Used:
                                                    </div>
                                                    {message.toolCalls.map((tool, index) => (
                                                        <div key={index}>
                                                            <strong>{tool.name}</strong>
                                                            <div className="text-xs mt-0.5">
                                                                ✅ Completed successfully
                                                            </div>
                                                        </div>
                                                    ))}
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
                    
                    <div ref={messagesEndRef} />
                </div>
            </div>
        </div>
    )
}