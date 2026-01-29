'use client'

import JkInputSection from "./jkInputSection";
import JkChatWindow from "./jkChatWindow";
import JkSidebar from "./jkSIdebar";
import JkConsoleHeader from "./jkConsole-Header";
import JkFileUploadModal from "./jkFileUploadModal";
import { useState, useCallback } from "react";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";

export default function JkConsole() {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { 
        currentMode, 
        isFileModalOpen, 
        setIsFileModalOpen,
        setDroppedFile,
        setFileName,
        setIsFileMode,
        setCurrentMode,
        allModes
    } = useJobKompassChatWindow()
    
    // Only show input in chat mode
    const shouldShowInput = currentMode.id === '/chat'

    const handleFileSelect = useCallback((file: File) => {
        setDroppedFile(file);
        setFileName(file.name);
        setIsFileMode(true);
        // Switch to file mode
        const fileMode = allModes.find(mode => mode.id === '/file');
        if (fileMode) {
            setCurrentMode(fileMode);
        }
    }, [setDroppedFile, setFileName, setIsFileMode, setCurrentMode, allModes]);

    return (
        <div className="flex h-screen w-full bg-background">
            {/* Desktop Sidebar - Using JkSidebar component */}
            <aside className="hidden lg:flex">
                <JkSidebar />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-transparent">
                {/* Headers (Desktop & Mobile) */}
                <JkConsoleHeader sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

                {/* Chat Window */}
                <div className="flex-1 overflow-hidden flex flex-col relative">
                    {/* File Upload Modal - Positioned relative to this container */}
                    <JkFileUploadModal
                        isOpen={isFileModalOpen}
                        onClose={() => setIsFileModalOpen(false)}
                        onFileSelect={handleFileSelect}
                    />
                    <JkChatWindow />
              
                    {/* Input Section - Only show in home and chat modes */}
                    {shouldShowInput && (
                    <div className="bg-transparent px-6 pt-2 translate-y-[-20px] fixed bottom-0 place-self-center w-full max-w-3xl">
                        <div className="max-w-3xl mx-auto w-full">
                            <JkInputSection />
                        </div>
                    </div>
                    )}
              
                </div>


            </main>
        </div>
    )
}
