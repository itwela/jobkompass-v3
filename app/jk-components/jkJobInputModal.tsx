'use client'

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import JkInputSection from "./jkInputSection";
import { toast } from "@/lib/toast";

interface JkJobInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobAdded?: () => void;
}

export default function JkJobInputModal({
  isOpen,
  onClose,
  onJobAdded,
}: JkJobInputModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 300); // Wait for animation
    }
  }, [isOpen]);

  // Clear input when modal closes
  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  const handleSend = async (value: string) => {
    if (!value.trim() || isSubmitting) return;

    setInputValue(""); // Wipe input immediately so it acts like a real input
    setIsSubmitting(true);
    const toastId = toast.loading("Adding job(s) to your tracker...");

    try {
      const response = await fetch('/api/jobs/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobInformation: value.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      // 2xx = success (job was added). Only treat non-2xx as failure so we never throw when the API actually succeeded.
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Failed to add job');
      }

      toast.dismiss(toastId);
      toast.success(data?.message ?? 'Job(s) added successfully!', {
        description:
          typeof data?.jobsAdded === 'number'
            ? `${data.jobsAdded} job(s) have been added to your tracker.`
            : undefined
      });

      setInputValue("");
      onJobAdded?.();
      onClose();
    } catch (error) {
      console.error('Error adding job:', error);
      toast.dismiss(toastId);
      toast.error("Failed to add job", {
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute bottom-0 left-0 right-0 z-50 bg-transparent px-6 pt-2 translate-y-[-20px]"
        >
          <div className="max-w-3xl mx-auto w-full relative">
            {/* Instructions */}
            <div className="mb-3 flex flex-col bg-background/80 backdrop-blur-sm border border-border rounded-lg p-2">
              <p className="text-sm text-muted-foreground">
                Add job information below. You can add 1 or multiple jobs. 
              </p>
            </div>

            {/* Input Section */}
            <JkInputSection
              hideFileUpload={true}
              hideContextMenu={true}
              placeholder="Paste job information, describe jobs to add, or list multiple jobs..."
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSend}
              textareaRef={textareaRef}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

