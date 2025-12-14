'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useJobKompassResume } from "@/providers/jkResumeProvider";

export type JkDocumentType = "resume" | "cover-letter";

export type JkSelectedDocument =
  | { id: string; type: JkDocumentType }
  | null;

export type JkDocumentItem = any & {
  documentType: JkDocumentType;
  _id: string;
};

interface JobKompassDocumentsContextType {
  documents: JkDocumentItem[];
  resumeList: any[];
  coverLetterList: any[];
  isLoading: boolean;

  selectedDocument: JkSelectedDocument;
  selectDocument: (id: string, type: JkDocumentType) => void;

  // Trigger a download for a resume file (uses cached selected-resume URL when possible)
  downloadFirstVersionResume: (fileId: Id<"_storage"> | undefined) => void;
}

const DocumentsContext = createContext<JobKompassDocumentsContextType | null>(null);

export function JobKompassDocumentsProvider({ children }: { children: React.ReactNode }) {
  const { resumes, currentResumeId, setCurrentResumeId } = useJobKompassResume();
  const convex = useConvex();

  const coverLetters = useQuery(api.documents.listCoverLetters);

  const resumeList = Array.isArray(resumes) ? resumes : [];
  const coverLetterList = Array.isArray(coverLetters) ? coverLetters : [];

  const isLoading = resumes === undefined || coverLetters === undefined;

  const documents: JkDocumentItem[] = useMemo(() => {
    return [
      ...resumeList.map((doc: any) => ({ ...doc, documentType: "resume" as const, _id: String(doc._id) })),
      ...coverLetterList.map((doc: any) => ({ ...doc, documentType: "cover-letter" as const, _id: String(doc._id) })),
    ];
  }, [resumeList, coverLetterList]);

  const [selectedDocument, setSelectedDocument] = useState<JkSelectedDocument>(null);

  const selectDocument = useCallback(
    (id: string, type: JkDocumentType) => {
      setSelectedDocument({ id, type });
      if (type === "resume") {
        setCurrentResumeId(id);
      }
    },
    [setCurrentResumeId]
  );

  // Keep selectedDocument stable + ensure we always have a valid selection when docs load/change.
  useEffect(() => {
    if (isLoading) return;

    const docs = documents;
    if (docs.length === 0) {
      setSelectedDocument(null);
      return;
    }

    // If nothing selected yet, prefer the current resume id (if any), else first resume, else first doc.
    if (!selectedDocument) {
      const currentResume = currentResumeId ? resumeList.find((r: any) => String(r._id) === String(currentResumeId)) : null;
      if (currentResume) {
        setSelectedDocument({ id: String(currentResume._id), type: "resume" });
        return;
      }
      const firstResume = resumeList[0];
      if (firstResume) {
        setSelectedDocument({ id: String(firstResume._id), type: "resume" });
        setCurrentResumeId(String(firstResume._id));
        return;
      }
      const firstDoc = docs[0];
      setSelectedDocument({ id: String(firstDoc._id), type: firstDoc.documentType });
      return;
    }

    // If the selected doc no longer exists (deleted), pick a new one.
    const stillExists = docs.some(
      (d) => d.documentType === selectedDocument.type && String(d._id) === String(selectedDocument.id)
    );
    if (!stillExists) {
      const firstResume = resumeList[0];
      if (firstResume) {
        setSelectedDocument({ id: String(firstResume._id), type: "resume" });
        setCurrentResumeId(String(firstResume._id));
        return;
      }
      const firstDoc = docs[0];
      setSelectedDocument({ id: String(firstDoc._id), type: firstDoc.documentType });
    }
  }, [coverLetters, resumes, documents, isLoading, selectedDocument, currentResumeId, resumeList, setCurrentResumeId]);

  // One-shot download function (imperative query -> open URL). No state/useEffect needed.
  const downloadFirstVersionResume = async (fileId: Id<"_storage"> | undefined) => {
    if (!fileId) {
      console.log("No fileId provided");
      return;
    }

    try {
      console.log("Downloading file with fileId:", fileId);
      const url = await convex.query(api.documents.getFileUrlById, { fileId });
      if (url) window.open(url, "_blank");
    } catch (err) {
      console.error("Failed to download resume file:", err);
    }
  };

  const value: JobKompassDocumentsContextType = {
    documents,
    resumeList,
    coverLetterList,
    isLoading,
    selectedDocument,
    selectDocument,
    downloadFirstVersionResume,
  };

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export const useJobKompassDocuments = () => {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useJobKompassDocuments must be used within a JobKompassDocumentsProvider");
  return ctx;
};


