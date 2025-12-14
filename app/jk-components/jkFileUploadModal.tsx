'use client'

import { useCallback, useState } from "react";
import { X, Upload, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface JkFileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
}

export default function JkFileUploadModal({ isOpen, onClose, onFileSelect }: JkFileUploadModalProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidImageFile = useCallback((file: File): boolean => {
    return file.type.startsWith('image/');
  }, []);

  const handleFileValidation = useCallback((file: File): boolean => {
    if (!isValidImageFile(file)) {
      setError(`Only image files are supported. Please upload a file with one of these extensions: JPG, JPEG, PNG, GIF, WEBP, SVG, or BMP.`);
      setTimeout(() => setError(null), 5000);
      return false;
    }
    setError(null);
    return true;
  }, [isValidImageFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (handleFileValidation(file)) {
        onFileSelect(file);
        onClose();
      }
    }
  }, [onFileSelect, onClose, handleFileValidation]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (handleFileValidation(file)) {
        onFileSelect(file);
        onClose();
      } else {
        // Reset the input so user can try again
        e.target.value = '';
      }
    }
  }, [onFileSelect, onClose, handleFileValidation]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Transparent Backdrop - Clickable but invisible */}
          <div
            className="absolute inset-0 z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: -200 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -200 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Upload File</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative border-2 border-dashed rounded-xl p-12
                    transition-all duration-200 cursor-pointer
                    ${isDragOver 
                      ? 'border-primary bg-primary/10 scale-[1.02]' 
                      : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50'
                    }
                  `}
                  onClick={() => document.getElementById('modal-file-input')?.click()}
                >
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <div className={`
                      rounded-full p-4 transition-colors
                      ${isDragOver ? 'bg-primary/20' : 'bg-background'}
                    `}>
                      <FileText className={`h-12 w-12 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    
                    <div>
                      <p className="text-lg font-medium mb-1">
                        {isDragOver ? 'Drop your image here' : 'Drag and drop your image here'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        or click to browse
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                      <span>Currently supporting image uploads only</span>
                      <span className="text-[10px] opacity-75">
                        Supported formats: JPG, JPEG, PNG, GIF, WEBP, SVG, BMP
                      </span>
                      <span className="text-[10px] opacity-60">More document types coming in later updates</span>
                    </div>
                  </div>

                  <input
                    type="file"
                    id="modal-file-input"
                    className="hidden"
                    onChange={handleFileInput}
                    accept="image/*"
                  />
                </div>

                {/* Error message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
                    >
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <p>{error}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Alternative action */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    💡 Tip: You can also drag images directly onto the input area
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
