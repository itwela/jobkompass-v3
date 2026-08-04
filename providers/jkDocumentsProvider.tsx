'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { toDownloadFileName } from "@/lib/downloadFileName";

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

  // Download a resume file straight to disk. `fileName` names the saved file;
  // it falls back to "resume.pdf" when the caller has no name to offer.
  downloadFirstVersionResume: (
    fileId: Id<"_storage"> | undefined,
    fileName?: string
  ) => void;
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

  // One-shot download: imperative query for the file URL, then save the bytes
  // to disk via an anchor with `download`.
  //
  // This used to open a new tab pointed at the raw Convex storage URL. Convex
  // serves the file inline, so the browser rendered the PDF in its viewer
  // instead of downloading it — and on mobile that tab was also a popup target.
  // Fetching the blob and clicking a `download` anchor is not a popup, needs no
  // new tab, and saves the file directly on desktop and mobile alike. Verified
  // that Convex storage reflects the request Origin, so the cross-origin fetch
  // is allowed.
  const downloadFirstVersionResume = async (
    fileId: Id<"_storage"> | undefined,
    fileName?: string
  ) => {
    if (!fileId) {
      console.log("No fileId provided");
      return;
    }

    let objectUrl: string | undefined;
    try {
      const url = await convex.query(api.documents.getFileUrlById, { fileId });
      if (!url) {
        console.error("No file URL returned for resume file");
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Fetching resume file failed: ${response.status}`);
      }

      // Keep the served content type when there is one; Convex hands back
      // octet-stream for some uploads, which iOS treats as an unnamed binary.
      const raw = await response.blob();
      const blob = raw.type ? raw : new Blob([raw], { type: "application/pdf" });

      objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = toDownloadFileName(fileName);
      a.rel = "noopener";
      // Safari only honours `download` for an anchor that is in the document.
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Failed to download resume file:", err);
    } finally {
      // Revoking straight after `click()` can cancel the download before the
      // browser has read the blob, which is most visible on mobile Safari.
      if (objectUrl) {
        const toRevoke = objectUrl;
        setTimeout(() => URL.revokeObjectURL(toRevoke), 60_000);
      }
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


