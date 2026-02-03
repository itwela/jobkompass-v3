'use client'

import { useState } from 'react'
import JkPublicHeader from "@/app/jk-components/jkPublicHeader"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Mail, MessageSquare, User, Send } from "lucide-react"
import { toast } from "@/lib/toast"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const addContact = useMutation(api.contacts.add)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.name.trim()) {
      toast.error("Please enter your name")
      return
    }
    if (!formData.email.trim()) {
      toast.error("Please enter your email")
      return
    }
    if (!formData.subject.trim()) {
      toast.error("Please enter a subject")
      return
    }
    if (!formData.message.trim()) {
      toast.error("Please enter your message")
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)
    
    try {
      const result = await addContact({
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      })
      
      if (result.success) {
        toast.success("Message sent!", "We'll get back to you as soon as possible.")
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        })
      } else {
        toast.error(result.message || "Failed to send message")
      }
    } catch (error) {
      toast.error("Failed to send message", "Please try again later.")
      console.error("Contact form error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <JkPublicHeader showPricing={true} showSignIn={true} />
      
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-10">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Contact Us</h1>
          <p className="text-muted-foreground text-lg">
            Have questions or feedback? We'd love to hear from you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="space-y-8">
            <div className="bg-card border border-border rounded-xl p-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-primary" />
                Send us a message
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        name="name"
                        placeholder="Your name"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-medium">
                      Subject <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="subject"
                      name="subject"
                      placeholder="What's this regarding?"
                      value={formData.subject}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium">
                      Message <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Tell us how we can help..."
                      value={formData.message}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      rows={6}
                      className="min-h-[150px]"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Get in touch</h2>
              <p className="text-muted-foreground">
                We're here to help with any questions about JobKompass, our features, 
                or your career journey. Reach out and we'll respond as soon as possible.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-muted/50 border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-4">Common topics</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Account & Billing</p>
                      <p className="text-sm text-muted-foreground">
                        Questions about subscriptions, payments, or account management
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Technical Support</p>
                      <p className="text-sm text-muted-foreground">
                        Issues with platform features, bugs, or technical problems
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Feature Requests</p>
                      <p className="text-sm text-muted-foreground">
                        Suggestions for new features or improvements
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium">4</span>
                    </div>
                    <div>
                      <p className="font-medium">Partnerships</p>
                      <p className="text-sm text-muted-foreground">
                        Business inquiries, partnerships, or collaboration opportunities
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-4">Other ways to reach us</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">myjobkompass@gmail.com</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        For general inquiries and support
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Legal Inquiries</p>
                      <p className="text-sm text-muted-foreground">myjobkompass@gmail.com</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        For privacy, terms, and legal matters
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-3">Response time</h3>
                <p className="text-sm text-muted-foreground">
                  We typically respond to all inquiries within 1-2 business days. 
                  For urgent matters, please include "URGENT" in your subject line.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="font-semibold mb-4">Related pages</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link href="/privacy">
                  <Button variant="outline" className="w-full justify-start">
                    Privacy Policy
                  </Button>
                </Link>
                <Link href="/terms">
                  <Button variant="outline" className="w-full justify-start">
                    Terms of Service
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline" className="w-full justify-start">
                    Pricing
                  </Button>
                </Link>
                <Link href="/free-resume-generator">
                  <Button variant="outline" className="w-full justify-start">
                    Free Resume Generator
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}