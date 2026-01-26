'use client'

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import Image from "next/image";
import { mainAssets } from "../constants";
import { useMutation } from "convex/react";
import JkPublicHeader from "./jkPublicHeader";
import JkGetStartedButton from "./jkGetStartedButton";
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

  // Prevent auto-scroll on page load when URL has hash
  useEffect(() => {
    if (window.location.hash === '#waitlist') {
      // Remove hash from URL without scrolling
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const scrollToWaitlist = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const waitlistSection = document.getElementById('waitlist');
    if (waitlistSection) {
      const elementPosition = waitlistSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - 80; // Account for header
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <JkPublicHeader />

      {/* Hero Section */}
      <section className="relative flex-1 flex items-center justify-center px-6 py-20 overflow-hidden">
        {/* Hand Backdrop Visual */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-4xl h-full flex items-center justify-center"
          >
            {/* Left Hand */}
            <Image
              src="/images/jobkompass_hand_new_1.png"
              alt=""
              width={800}
              height={800}
              priority
              style={{
                objectFit: 'contain',
                opacity: 0.6,
                // Responsive: 0.3 on md:opacity-30 (>=768px)
                // We'll add this with a media query below
                transform: 'translateX(-20%) scaleX(-1)',
                width: '100%',
                height: '100%',
                display: 'block',
              }}
            />
            {/* Right Hand */}
            <Image
              src="/images/jobkompass_hand_new_1.png"
              alt=""
              width={800}
              height={800}
              priority
              style={{
                objectFit: 'contain',
                opacity: 0.6,
                // Responsive: 0.3 on md:opacity-30 (>=768px)
                // We'll add this with a media query below
                transform: 'translateX(20%)',
                width: '100%',
                height: '100%',
                display: 'block',
              }}
            />
          </motion.div>
        </div>

        <div className="relative z-10 max-w-4xl w-full text-center space-y-8">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
              <span className="inline-block">
                {'Meet JobKompass'.split('').map((char, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3 + index * 0.05,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    className="inline-block"
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </motion.span>
                ))}
              </span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 1.0,
                ease: [0.16, 1, 0.3, 1]
              }}
              className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
            >
              Manage your job search, organize applications, and create tailored resumes and cover letters—all in one place. Chat with your documents to refine and improve them.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 1.2,
              ease: [0.16, 1, 0.3, 1]
            }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.6,
                delay: 1.3,
                ease: [0.16, 1, 0.3, 1]
              }}
            >
              <JkGetStartedButton size="lg" className="text-base px-8" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.6,
                delay: 1.4,
                ease: [0.16, 1, 0.3, 1]
              }}
            >
              <Link href="#waitlist" onClick={scrollToWaitlist}>
                <Button size="lg" variant="outline" className="text-base px-8">
                  Join waitlist
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-12"
          >
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-3xl md:text-4xl font-semibold tracking-tight mb-4"
            >
              Capabilities
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-muted-foreground text-lg max-w-2xl mx-auto"
            >
              Everything you need to manage your career journey
            </motion.p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Organize applications",
                description: "Keep track of all your job applications in one centralized dashboard. Add detailed notes, set reminders for follow-ups, monitor application status, and quickly add multiple jobs at once. Stay organized and never lose track of where you've applied."
              },
              {
                title: "Tailored resumes & cover letters",
                description: "Create and customize resumes and cover letters for each position. Choose from professional templates, format your content with ease, and chat with your documents to refine and improve them."
              },
              {
                title: "Career guidance & interview prep",
                description: "Get personalized career advice with proper context from your documents. Use the chat to prep for interviews, refine your applications, and get expert guidance tailored to your career journey."
              }
            ].map((capability, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  duration: 0.8,
                  delay: 0.3 + index * 0.1,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="space-y-3"
              >
                <h3 className="text-xl font-semibold">{capability.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {capability.description}
                </p>
              </motion.div>
            ))}
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
