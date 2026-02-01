'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from '@/lib/toast';
import JkPublicHeader from '@/app/jk-components/jkPublicHeader';
import { getFreeResumeTemplates } from '@/lib/templates';
import { getModelsForFreeResume } from '@/lib/aiModels';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FileText,
  Download,
  Sparkles,
  Mail,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Upload,
  X,
  Plus,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { COPY_TO_AI_OPTIONS, getCopyPromptForTemplate } from '@/lib/copyToAiPrompts';

export default function FreeResumeGeneratorPage() {
  const [resumeText, setResumeText] = useState('');
  const [resumePdf, setResumePdf] = useState<string | null>(null);
  const [resumePdfName, setResumePdfName] = useState<string | null>(null);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [isPdfIframeLoaded, setIsPdfIframeLoaded] = useState(false);

  useEffect(() => {
    if (pdfBase64) setIsPdfIframeLoaded(false);
  }, [pdfBase64]);

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
    const payload: {
      resumeText?: string;
      resumePdf?: string;
      email: string;
      templateId: string;
    } = {
      email: emailToUse,
      templateId: selectedTemplateId,
    };
    if (resumePdf) {
      payload.resumePdf = resumePdf.startsWith('data:') ? resumePdf : `data:application/pdf;base64,${resumePdf}`;
    } else {
      // Client-side append: resume text + optional prompt with a space
      const textToSend = promptText.trim()
        ? `${resumeText.trim()} ${promptText.trim()}`
        : resumeText.trim();
      payload.resumeText = textToSend;
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      setShowPromptInput(false);
      setPromptText('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearPdf = () => {
    setResumePdf(null);
    setResumePdfName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
  };

  const handleChangeTemplate = () => {
    setSelectedTemplateId(null);
    setPdfBase64(null);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setPdfBase64(null);
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
    <div className="min-h-screen flex flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <JkPublicHeader showPricing showSignIn />
      <main className="flex-1">
        <section className="relative py-12 px-4 md:px-6 lg:px-8 overflow-hidden">
          {/* Subtle gradient orbs like landing */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="max-w-7xl mx-auto relative">
            <motion.div
              className="text-center mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                Free Resume Generator
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-4">
                Paste your resume text or upload a PDF, we&apos;ll extract and format it into a professional PDF for free. No signup
                required to start.
              </p>
              <TooltipProvider>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">Powered by</span>
                  {getModelsForFreeResume().map((model) => (
                    <Tooltip key={model.id}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-1 text-xs font-medium">
                          <Avatar className="h-4 w-4">
                            {model.logoUrl ? (
                              <AvatarImage src={model.logoUrl} alt="" />
                            ) : null}
                            <AvatarFallback className="text-[10px]">
                              {model.provider.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          {model.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="font-medium">{model.name}</p>
                        <p className="text-muted-foreground text-xs">{model.provider}</p>
                        {model.description ? (
                          <p className="text-muted-foreground text-xs mt-1">{model.description}</p>
                        ) : null}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
              <motion.div
                className="flex flex-col rounded-xl border border-border bg-card/50 p-6 max-h-[560px] min-h-[560px]"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                <label className="text-sm font-medium mb-2 flex-shrink-0">
                  <FileText className="h-4 w-4 inline mr-2" /> Paste text or upload PDF
                </label>
                <div className="flex-1 flex flex-col min-h-0">
                  {resumePdf ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                      <div className="flex items-center gap-2 p-4 rounded-lg border border-border bg-muted/30 w-full max-w-sm">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <span className="truncate flex-1 text-sm">{resumePdfName || 'resume.pdf'}</span>
                        <Button variant="ghost" size="sm" onClick={clearPdf} className="shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        AI instructions are available when pasting text (not with PDF upload).
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-2 w-full"
                        >
                          <Upload className="h-4 w-4" />
                          Upload PDF
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Or paste your resume content here. We'll extract your name, experience, education, skills, and more..."
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        className="flex-1 min-h-[220px] overflow-y-auto resize-none font-mono text-sm"
                        sanitize={false}
                      />
                      <div className="mt-auto pt-2 flex-shrink-0">
                      {!showPromptInput ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPromptInput(true)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Still need to add more instructions?
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g. emphasize leadership, make it more concise"
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            className="h-8 text-sm flex-1"
                            sanitize={false}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              setShowPromptInput(false);
                              setPromptText('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-auto pt-4 flex flex-col gap-3 flex-shrink-0">
                  <Button
                    onClick={handleGenerateClick}
                    disabled={!hasInput || !selectedTemplateId || isGenerating}
                    className="gap-2 w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Resume
                      </>
                    )}
                  </Button>
                  {emailVerified && storedEmail && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1 w-full justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      {storedEmail}
                    </span>
                  )}
                </div>
              </motion.div>

              <motion.div
                className="flex flex-col rounded-xl border border-border bg-card/50 p-6 max-h-[560px] min-h-[560px] overflow-y-auto no-scrollbar"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {!selectedTemplateId ? (
                  /* No template selected: show only template picker */
                  <div className="flex flex-col h-full min-h-0">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                      <label className="text-sm font-medium">
                        <Sparkles className="h-4 w-4 inline mr-2" />
                        Choose a template
                        <span className="ml-2 text-muted-foreground font-normal">
                          ({getFreeResumeTemplates().length} available)
                        </span>
                      </label>
                      {generatedDownloads.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                              <Download className="h-3.5 w-3.5" />
                              Downloads
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2" align="end">
                            <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                              Generated resumes
                            </p>
                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                              {generatedDownloads.map((d, idx) => (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => handleDownload(d.pdfBase64)}
                                  className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-muted text-left text-sm"
                                >
                                  <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate flex-1">
                                    {d.templateName} ({(idx + 1).toString()})
                                  </span>
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    <div className="flex flex-row gap-3 flex-1 min-h-0 overflow-x-auto no-scrollbar">
                      {getFreeResumeTemplates().map((template, index) => (
                        <motion.button
                          key={template.id}
                          type="button"
                          onClick={() => handleSelectTemplate(template.id)}
                          className="flex flex-col flex-shrink-0 w-[280px] min-w-[280px] h-full rounded-xl border-2 border-border hover:border-primary overflow-hidden transition-colors duration-200 text-left group"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.4, delay: 0.1 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div className="flex-1 min-h-0 relative bg-muted/30 aspect-[3/4]">
                            <Image
                              src={template.previewImage}
                              alt={template.name}
                              fill
                              className="object-cover object-top"
                              sizes="280px"
                            />
                            <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-opacity" />
                          </div>
                          <div className="p-3 bg-background/95 backdrop-blur-sm flex-shrink-0 rounded-b-xl overflow-hidden">
                            <p className="font-medium text-sm truncate">{template.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {template.tags?.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Template selected: show preview with template name at top */
                  <>
                    <div className="flex items-center justify-between mb-3 flex-shrink-0 gap-2">
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        Selected template: <span className="text-foreground">{getFreeResumeTemplates().find((t) => t.id === selectedTemplateId)?.name}</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={handleChangeTemplate}
                        >
                          Change template
                        </Button>
                        {generatedDownloads.length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Downloads
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2" align="end">
                              <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                                Generated resumes
                              </p>
                              <div className="max-h-[200px] overflow-y-auto space-y-1">
                                {generatedDownloads.map((d, idx) => (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => handleDownload(d.pdfBase64)}
                                    className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-muted text-left text-sm"
                                  >
                                    <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate flex-1">
                                      {d.templateName} ({(idx + 1).toString()})
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden">
                      <div className="flex-1 min-h-[320px] flex flex-col items-center justify-center overflow-hidden p-4">
                        {pdfBase64 ? (
                          <div className="w-full h-full flex flex-col min-h-0">
                            <div className="relative flex-1 min-h-[320px] w-full bg-white overflow-hidden">
                              {!isPdfIframeLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                                </div>
                              )}
                              <iframe
                                src={`data:application/pdf;base64,${pdfBase64}#toolbar=0`}
                                className="flex-1 min-h-[320px] w-full"
                                title="Resume preview"
                                onLoad={() => setIsPdfIframeLoaded(true)}
                              />
                            </div>
                            <Button onClick={() => handleDownload()} className="mt-4 gap-2 w-full flex-shrink-0">
                              <Download className="h-4 w-4" />
                              Download PDF
                            </Button>
                          </div>
                        ) : isGenerating ? (
                          <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="text-sm">Generating your resume PDF...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
                            <div className="w-full">
                              <p className="text-sm text-foreground font-medium text-center mb-3">
                                Not sure what to put? Your AI already knows you.
                              </p>
                              <p className="text-xs text-muted-foreground text-center mb-4">
                                Copy the prompt, paste it into your AI, then paste the output back here.
                              </p>
                              <div className="flex flex-col gap-2 items-center">
                                {COPY_TO_AI_OPTIONS.map((ai) => (
                                  <div
                                    key={ai.id}
                                    className="flex items-center gap-1 w-full max-w-[240px]"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const prompt = getCopyPromptForTemplate('resume');
                                        navigator.clipboard.writeText(prompt).then(() => {
                                          toast.success('Prompt copied to clipboard', {
                                            description: 'Paste into your AI, then copy the output back here.',
                                          });
                                        }).catch(() => {
                                          toast.error('Failed to copy');
                                        });
                                      }}
                                      className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors text-left"
                                    >
                                      <Avatar className="h-5 w-5 shrink-0">
                                        <AvatarImage src={ai.logoUrl} alt="" />
                                        <AvatarFallback className="text-xs">
                                          {ai.name.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-sm font-medium flex-1">{ai.name}</span>
                                      <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    </button>
                                    <a
                                      href={ai.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors shrink-0"
                                      aria-label={`Open ${ai.name}`}
                                    >
                                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <p className="text-muted-foreground text-center text-sm mt-2">
                              Your formatted resume will appear here after generation.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </div>

            <motion.div
              className="mt-12 p-6 rounded-xl border border-primary/20 bg-primary/5 text-center"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <h3 className="font-semibold text-lg mb-2">
                Love this? Get more with JobKompass
              </h3>
              <p className="text-muted-foreground mb-4 max-w-xl mx-auto">
                JobKompass offers AI-powered resume tailoring, cover letters, job tracking, and
                career guidance. Sign up to create tailored resumes for each application.
              </p>
              <Link href="/auth">
                <Button size="lg" className="gap-2">
                  Get Started with JobKompass
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <Dialog open={showEmailGate} onOpenChange={setShowEmailGate}>
        <DialogContent className="sm:max-w-md">
          {gateMode === 'limit' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Free limit reached
                </DialogTitle>
                <DialogDescription>
                  You&apos;ve used your 2 free resumes. Sign up for JobKompass to unlock unlimited
                  resume generation, AI tailoring, job tracking, and more.
                </DialogDescription>
              </DialogHeader>
              <div className="pt-2">
                <Link href="/auth">
                  <Button className="w-full" size="lg">
                    Sign up for JobKompass
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  One quick step to generate
                </DialogTitle>
                <DialogDescription>
                  Join our email list to use the free resume generator. We&apos;ll only send you useful
                  career tips — no spam.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 border-b mb-4">
            <button
              type="button"
              onClick={() => setGateMode('signup')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                gateMode === 'signup'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setGateMode('verify')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                gateMode === 'verify'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              I&apos;m already on the mailing list :D
            </button>
          </div>
          {gateMode === 'signup' ? (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label htmlFor="gate-name" className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="gate-name"
                  type="text"
                  placeholder="Your name"
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  required
                  className="mt-1"
                  sanitize={false}
                />
              </div>
              <div>
                <label htmlFor="gate-email" className="text-sm font-medium">
                  Email <span className="text-destructive">*</span>
                </label>
                <Input
                  id="gate-email"
                  type="email"
                  placeholder="you@example.com"
                  value={gateEmail}
                  onChange={(e) => setGateEmail(e.target.value)}
                  required
                  className="mt-1"
                  sanitize={false}
                />
              </div>
              <Button type="submit" className="w-full">
                Sign up & Generate
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <label htmlFor="verify-email" className="text-sm font-medium">
                  Enter the email you used
                </label>
                <Input
                  id="verify-email"
                  type="email"
                  placeholder="you@example.com"
                  value={verifyEmail}
                  onChange={(e) => setVerifyEmail(e.target.value)}
                  required
                  className="mt-1"
                  sanitize={false}
                />
              </div>
              <Button type="submit" className="w-full">
                Verify & Generate
              </Button>
            </form>
          )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
