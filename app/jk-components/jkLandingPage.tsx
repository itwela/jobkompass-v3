'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import Image from "next/image";
import { mainAssets } from "../constants";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "@/lib/toast";
import { ChevronDown, ChevronUp, X, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What is JobKompass?",
    answer: "JobKompass is a career management platform that helps you organize your job search, manage resumes, and streamline your application process. It's designed to make your career journey more efficient and organized."
  },
  {
    question: "How do I get started?",
    answer: "Simply click 'Enter JobKompass' to begin. You can start by adding your first job application or uploading your resume. The platform will guide you through the setup process."
  },
  {
    question: "Is my data secure?",
    answer: "Yes, we take data security seriously. All your information is encrypted and stored securely. We never share your personal data with third parties."
  },
  {
    question: "Can I customize my resume?",
    answer: "Absolutely. JobKompass offers multiple resume templates and allows you to customize your resume for each job application. You can edit, format, and tailor your resume to match specific job requirements."
  },
  {
    question: "How do I track my job applications?",
    answer: "You can add jobs to your dashboard and track their status. The platform helps you organize applications by company, position, and status, making it easy to stay on top of your job search."
  },
  {
    question: "Is there a mobile app?",
    answer: "JobKompass is currently available as a web application that works on all devices. We're working on dedicated mobile apps and will notify waitlist members when they're available."
  }
];

function FAQItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full py-6 text-left flex items-center justify-between gap-4 hover:text-foreground transition-colors"
      >
        <span className="text-lg font-medium">{item.question}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="pb-6 text-muted-foreground leading-relaxed">
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function JkLandingPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  
  const addToWaitlist = useMutation(api.waitlist.add);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addToWaitlist({ email, name: name || undefined });
      
      if (result.success) {
        setEmail("");
        setName("");
        setShowThankYouModal(true);
      } else {
        toast.error(result.message || "Failed to add to waitlist");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      console.error("Waitlist error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation */}
      <nav className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-end gap-3">
            <Image
              src={mainAssets.logo}
              alt="JobKompass Logo"
              width={30}
              height={30}
              className="object-contain"
              priority
            />
            <span className="text-xl font-semibold tracking-tight">JobKompass</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/app">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/app">
              <Button size="sm">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-4xl w-full text-center space-y-8">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
              Your career journey,<br />organized
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Manage your job search, organize applications, and create tailored resumes—all in one place.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link href="/app">
              <Button size="lg" className="text-base px-8">
                Get started
              </Button>
            </Link>
            <Link href="#waitlist">
              <Button size="lg" variant="outline" className="text-base px-8">
                Join waitlist
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Organize applications</h3>
              <p className="text-muted-foreground leading-relaxed">
                Keep track of all your job applications in one place. Add notes, set reminders, and monitor your progress.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Tailored resumes</h3>
              <p className="text-muted-foreground leading-relaxed">
                Create and customize resumes for each position. Choose from professional templates and format your content with ease.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Stay on track</h3>
              <p className="text-muted-foreground leading-relaxed">
                Never miss a deadline or follow-up. JobKompass helps you manage your job search timeline effectively.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="py-20 px-6 border-t border-border bg-muted/30">
        <div className="max-w-2xl mx-auto">
          <div className="text-center space-y-4 mb-8">
            <h2 className="text-3xl font-semibold tracking-tight">Stay updated</h2>
            <p className="text-muted-foreground">
              Join our waitlist to be notified about new features and updates
            </p>
          </div>

          <form onSubmit={handleWaitlistSubmit} className="space-y-4 bg-card border border-border rounded-lg p-8">
            <div className="space-y-2">
              <label htmlFor="waitlist-name" className="text-sm font-medium">
                Name (optional)
              </label>
              <Input
                id="waitlist-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="waitlist-email" className="text-sm font-medium">
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                id="waitlist-email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-11"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="default"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Join waitlist"}
            </Button>
          </form>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
            <p className="text-muted-foreground">
              Everything you need to know about JobKompass
            </p>
          </div>

          <div className="space-y-0">
            {faqData.map((item, index) => (
              <FAQItem
                key={index}
                item={item}
                isOpen={openFAQ === index}
                onToggle={() => toggleFAQ(index)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src={mainAssets.logo}
              alt="JobKompass Logo"
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="text-sm text-muted-foreground">JobKompass</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} JobKompass. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Thank You Modal */}
      <AnimatePresence>
        {showThankYouModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowThankYouModal(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-end p-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowThankYouModal(false)}
                    className="h-8 w-8 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="px-8 pb-8 text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      Thank you!
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      You've been successfully added to our waitlist. We'll notify you when new features and updates are available.
                    </p>
                  </div>

                  <Button
                    onClick={() => setShowThankYouModal(false)}
                    className="w-full"
                  >
                    Got it
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
