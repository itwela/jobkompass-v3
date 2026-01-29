'use client'

import { useState } from "react";
import JkCW_DocumentsForm from "./jkChatWindow-DocumentsForm";
import { Button } from "@/components/ui/button";
import { FileText, FileCheck, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/jkAuthProvider";
import { motion } from "framer-motion";
import { JobKompassDocumentsProvider } from "@/providers/jkDocumentsProvider";

type DocumentTypeFilter = "all" | "resume" | "cover-letter";

export default function JkCW_DocumentsMode() {
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilter>("all");
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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
              Please sign in to view and manage your documents. Click the JobKompass icon in the sidebar to sign in.
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
    <div className="h-full overflow-y-auto overflow-x-hidden min-w-0">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 min-w-0">
        <header className="space-y-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Documents</h1>
            <p className="text-muted-foreground mt-1">
                Upload and manage your documents such as resumes and cover letters. Add labels and tags to organize them.
              </p>
          </div>
          
          {/* Document Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Filter by type:</span>
            <div className="flex items-center gap-2">
              <Button
                variant={typeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("all")}
                className={cn(
                  "gap-2",
                  typeFilter === "all" && "bg-primary text-primary-foreground"
                )}
              >
                All
              </Button>
              <Button
                variant={typeFilter === "resume" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("resume")}
                className={cn(
                  "gap-2",
                  typeFilter === "resume" && "bg-primary text-primary-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Resumes
              </Button>
              <Button
                variant={typeFilter === "cover-letter" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("cover-letter")}
                className={cn(
                  "gap-2",
                  typeFilter === "cover-letter" && "bg-primary text-primary-foreground"
                )}
              >
                <FileCheck className="h-3.5 w-3.5" />
                Cover Letters
              </Button>
            </div>
          </div>
        </header>

        <JobKompassDocumentsProvider>
          <JkCW_DocumentsForm typeFilter={typeFilter} />
        </JobKompassDocumentsProvider>

      </div>
    </div>
  );
}