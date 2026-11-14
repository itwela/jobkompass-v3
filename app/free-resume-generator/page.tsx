'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from '@/lib/toast';
import { getFreeResumeTemplates, getLockedFreeResumeTemplates } from '@/lib/templates';
import { trackFirstResumeCreated, trackFreeGeneratorCompleted, trackFreeGeneratorStarted, trackResumeExported } from '@/lib/analytics/client';
import { rateLimitMessageFromResponse } from '@/lib/rateLimit/message';
import JkFreeEmailGate from '@/app/jk-components/jk-free/jkFreeEmailGate';
import JkFreeGeneratorView, { type FreeStep } from '@/app/jk-components/jk-free/jkFreeGeneratorView';

export default function FreeResumeGeneratorPage() {
  const [step, setStep] = useState<FreeStep>(1);
  const [resumeText, setResumeText] = useState('');
  const [resumePdf, setResumePdf] = useState<string | null>(null);
  const [resumePdfName, setResumePdfName] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(() => getFreeResumeTemplates()[0]?.id ?? null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateMode, setGateMode] = useState<'signup' | 'verify' | 'limit'>('signup');
  const [gateEmail, setGateEmail] = useState('');
  const [gateName, setGateName] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [generatedDownloads, setGeneratedDownloads] = useState<
    { id: string; templateName: string; pdfBase64: string }[]
  >([]);

  const addToEmailList = useMutation(api.emailList.add);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const hasHandledVerify = useRef(false);

  const checkResult = useQuery(
    api.emailList.checkEmail,
    pendingVerifyEmail && gateMode === 'verify'
      ? { email: pendingVerifyEmail, submissionType: 'free-resume' }
      : 'skip'
  );

  const hasInput = resumeText.trim() || resumePdf;

  const doGenerate = useCallback(async (emailOverride?: string) => {
    const emailToUse = emailOverride ?? storedEmail;
    if (!emailToUse || !hasInput || !selectedTemplateId) return;
    setIsGenerating(true);
    setPdfBase64(null);
    setStep(3);
    const payload: {
      resumeText?: string;
      resumePdf?: string;
      styleInstructions?: string;
      email: string;
      templateId: string;
    } = {
      email: emailToUse,
      templateId: selectedTemplateId,
    };
    if (resumePdf) {
      payload.resumePdf = resumePdf.startsWith('data:') ? resumePdf : `data:application/pdf;base64,${resumePdf}`;
    } else {
      // Resume text stays the only source of facts. Instructions are sent separately.
      payload.resumeText = resumeText.trim();
      if (promptText.trim()) {
        payload.styleInstructions = promptText.trim();
      }
    }
    try {
      const res = await fetch('/api/free-resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data: { error?: string; details?: string; limitReached?: boolean; pdfBase64?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = { error: `Server error (${res.status} ${res.statusText})` };
      }
      if (res.status === 429) {
        toast.error(rateLimitMessageFromResponse(res), { duration: 10000 });
        return;
      }
      if (!res.ok) {
        toast.error(data.error || 'Failed to parse resume', {
          description: data.details || (res.status >= 500 ? `Status: ${res.status} ${res.statusText}` : undefined),
          duration: 10000,
        });
        if (res.status === 403) {
          if (data.limitReached) {
            setShowEmailGate(true);
            setGateMode('limit');
          } else {
            setEmailVerified(false);
            setStoredEmail(null);
            setShowEmailGate(true);
          }
        }
        return;
      }
      setPdfBase64(data.pdfBase64!);
      trackFreeGeneratorCompleted(selectedTemplateId);
      trackFirstResumeCreated('free_generator', 'free_generator', selectedTemplateId);
      const templateName = getFreeResumeTemplates().find((t) => t.id === selectedTemplateId)?.name ?? selectedTemplateId;
      setGeneratedDownloads((prev) => [
        ...prev,
        { id: crypto.randomUUID(), templateName, pdfBase64: data.pdfBase64! },
      ]);
      toast.success('Resume formatted successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Something went wrong. Please try again.', {
        description: msg,
        duration: 10000,
      });
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }, [storedEmail, resumeText, resumePdf, promptText, hasInput, selectedTemplateId]);

  const handleGenerateClick = useCallback(() => {
    if (!hasInput) {
      toast.error('Please paste your resume text or upload a PDF');
      return;
    }
    if (!selectedTemplateId) {
      toast.error('Please select a template first');
      return;
    }
    trackFreeGeneratorStarted(selectedTemplateId);
    if (!emailVerified || !storedEmail) {
      setShowEmailGate(true);
      setGateMode('signup');
      setGateEmail('');
      setGateName('');
      setVerifyEmail('');
      return;
    }
    doGenerate();
  }, [hasInput, selectedTemplateId, emailVerified, storedEmail, doGenerate]);

  const handlePdfFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('PDF must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1]! : result;
      setResumePdf(base64);
      setResumePdfName(file.name);
      setResumeText('');
      setPromptText('');
    };
    reader.readAsDataURL(file);
  };

  const clearPdf = () => {
    setResumePdf(null);
    setResumePdfName(null);
  };

  const runGenerateAfterVerify = useCallback(
    (email: string) => {
      setEmailVerified(true);
      setStoredEmail(email);
      setShowEmailGate(false);
      setVerifyEmail('');
      setPendingVerifyEmail(null);
      setGateMode('signup');
      toast.success('Email verified! Generating...');
      doGenerate(email);
    },
    [doGenerate]
  );

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!gateEmail.trim()) {
      toast.error('Please enter your email');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(gateEmail.trim())) {
      toast.error('Please enter a valid email');
      return;
    }
    try {
      const result = await addToEmailList({
        email: gateEmail.trim().toLowerCase(),
        name: gateName.trim(),
        submissionType: 'free-resume',
      });
      const email = gateEmail.trim().toLowerCase();
      if (result.success) {
        setEmailVerified(true);
        setStoredEmail(email);
        setShowEmailGate(false);
        toast.success(
          result.alreadyExisted
            ? "You're already on the list. Generating..."
            : "You're in! Generating your resume..."
        );
        doGenerate(email);
      } else {
        toast.error(result.message || 'Failed to sign up');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = verifyEmail.trim();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }
    setPendingVerifyEmail(email.toLowerCase());
    hasHandledVerify.current = false;
  };

  useEffect(() => {
    if (gateMode !== 'verify' || !pendingVerifyEmail || hasHandledVerify.current) return;
    if (checkResult === undefined) return;
    hasHandledVerify.current = true;
    if (checkResult.found) {
      runGenerateAfterVerify(pendingVerifyEmail);
    } else {
      toast.error('Email not found. Please sign up first.');
      setVerifyEmail('');
      setPendingVerifyEmail(null);
    }
  }, [gateMode, pendingVerifyEmail, checkResult, runGenerateAfterVerify]);

  const handleDownload = (pdfBase64ToUse?: string) => {
    const b64 = pdfBase64ToUse ?? pdfBase64;
    if (!b64) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${b64}`;
    link.download = 'formatted-resume.pdf';
    link.click();
    trackResumeExported({ method: 'download', template_id: selectedTemplateId });
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setPdfBase64(null);
  };

  const handleLockedTemplate = (templateName: string) => {
    toast.info(`${templateName} is a premium template`, {
      description: 'Subscribe to JobKompass to generate resumes with this design.',
    });
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Free Resume Generator',
    description:
      'Paste your resume text — we extract and format it into a professional PDF for free. Extract experience, education, skills automatically. Download in seconds. No signup required to start.',
    applicationCategory: 'BusinessApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'Free resume generation',
      'Upload PDF or paste text',
      'Automatic extraction of experience, education, skills',
      'Professional PDF formatting',
      'Download formatted resume',
      'No signup required to access',
    ],
    url: 'https://jobkompass.com/free-resume-generator',
    author: { '@type': 'Organization', name: 'JobKompass' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <JkFreeGeneratorView
        step={step}
        onStep={setStep}
        resumeText={resumeText}
        onResumeText={setResumeText}
        pdfName={resumePdf ? resumePdfName || 'resume.pdf' : null}
        onPdfFile={handlePdfFile}
        onClearPdf={clearPdf}
        promptText={promptText}
        onPromptText={setPromptText}
        freeTemplates={getFreeResumeTemplates()}
        lockedTemplates={getLockedFreeResumeTemplates()}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={handleSelectTemplate}
        onLockedTemplate={handleLockedTemplate}
        onGenerate={handleGenerateClick}
        isGenerating={isGenerating}
        pdfBase64={pdfBase64}
        onDownload={handleDownload}
        downloads={generatedDownloads}
        storedEmail={emailVerified ? storedEmail : null}
        onNeedInput={() => toast.error('Paste your resume text or upload a PDF first')}
      />

      <JkFreeEmailGate
        open={showEmailGate}
        onOpenChange={setShowEmailGate}
        mode={gateMode}
        onMode={setGateMode}
        name={gateName}
        onName={setGateName}
        email={gateEmail}
        onEmail={setGateEmail}
        verifyEmail={verifyEmail}
        onVerifyEmail={setVerifyEmail}
        onSignup={handleSignupSubmit}
        onVerify={handleVerifySubmit}
      />
    </>
  );
}
