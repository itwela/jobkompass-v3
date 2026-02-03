'use client'

import { useState } from "react";
import { X, FileText, FileCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { getAppResumeTemplateOptions, COVER_LETTER_TEMPLATES } from "@/lib/templates";

export type DocumentType = "resume" | "cover-letter";

export interface TemplateOption {
  id: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
}

interface JkTemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (documentType: DocumentType, templateId: string) => void;
  jobId?: Id<"jobs">;
  jobTitle?: string;
  jobCompany?: string;
}

const resumeTemplates: TemplateOption[] = getAppResumeTemplateOptions().map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  icon: <FileText className="h-5 w-5" />,
}));

const coverLetterTemplates: TemplateOption[] = COVER_LETTER_TEMPLATES.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  icon: <FileCheck className="h-5 w-5" />,
}));

export default function JkTemplateSelectionModal({
  isOpen,
  onClose,
  onSelect,
  jobId,
  jobTitle,
  jobCompany,
}: JkTemplateSelectionModalProps) {
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);

  const handleDocumentTypeSelect = (type: DocumentType) => {
    setSelectedDocumentType(type);
  };

  // REVIEW: Template Selection
  const handleTemplateSelect = (templateId: string) => {
    if (selectedDocumentType) {
      onSelect(selectedDocumentType, templateId);
      onClose();
      setSelectedDocumentType(null);
    }
  };

  const handleBack = () => {
    setSelectedDocumentType(null);
  };

  const templates = selectedDocumentType === "resume" 
    ? resumeTemplates 
    : selectedDocumentType === "cover-letter"
    ? coverLetterTemplates
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full lg:w-[75vw] h-[85vh] max-h-[800px] px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-border flex-shrink-0 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Generate Document</h2>
                    {jobTitle && jobCompany && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        For: {jobTitle} at {jobCompany}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-9 w-9 rounded-full hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-8 lg:p-12 flex-1 overflow-y-auto">
                {!selectedDocumentType ? (
                  // Document Type Selection
                  <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                      <h3 className="text-2xl font-semibold mb-3">What would you like to create?</h3>
                      <p className="text-muted-foreground text-lg">
                        Choose the type of document you want to generate for this position
                      </p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleDocumentTypeSelect("resume")}
                        className="group p-8 border-2 border-border rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                              <FileText className="h-7 w-7 text-primary" />
                            </div>
                            <h3 className="font-semibold text-2xl">Resume</h3>
                          </div>
                          <p className="text-muted-foreground text-base leading-relaxed">
                            Generate a professional, ATS-optimized resume tailored specifically for this position
                          </p>
                        </div>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleDocumentTypeSelect("cover-letter")}
                        className="group p-8 border-2 border-border rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                              <FileCheck className="h-7 w-7 text-primary" />
                            </div>
                            <h3 className="font-semibold text-2xl">Cover Letter</h3>
                          </div>
                          <p className="text-muted-foreground text-base leading-relaxed">
                            Create a personalized cover letter that highlights your fit for this role
                          </p>
                        </div>
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  // REVIEW: Template Selection
                  <div className="flex flex-col h-full max-w-3xl mx-auto">
                    <div className="flex items-center gap-3 mb-8">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        className="h-9 px-4"
                      >
                        ← Back
                      </Button>
                      <div className="h-6 w-px bg-border" />
                      <h3 className="text-xl font-semibold">
                        Select {selectedDocumentType === "resume" ? "Resume" : "Cover Letter"} Template
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4 flex-1 content-start">
                      {templates.map((template, index) => (
                        <motion.button
                          key={template.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.01, y: -2 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handleTemplateSelect(template.id)}
                          className="group p-6 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative flex items-start gap-4">
                            {template.icon && (
                              <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors flex-shrink-0">
                                {template.icon}
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-semibold text-lg mb-2">{template.name}</h4>
                              <p className="text-muted-foreground leading-relaxed">
                                {template.description}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
