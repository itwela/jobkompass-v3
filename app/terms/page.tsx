'use client'

import JkPublicHeader from "@/app/jk-components/jkPublicHeader"
import JkFooter from "@/app/jk-components/jkFooter"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <JkPublicHeader showPricing={true} showSignIn={true} />
      
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-10">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
          <p className="text-muted-foreground text-lg">
            Effective date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using JobKompass ("the Platform"), you accept and agree to be bound by these Terms of Service. 
              If you do not agree to these terms, you must not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p>
              JobKompass is an AI-powered career management platform that provides tools for job application tracking, 
              resume and cover letter generation, and career guidance. The Platform uses artificial intelligence to 
              assist users in their job search and career development.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p>To access certain features of the Platform, you must register for an account. You agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and accept all risks of unauthorized access</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Be responsible for all activities that occur under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Subscription and Payments</h2>
            <p>
              Some features of the Platform require payment. By subscribing to a paid plan, you agree to pay all 
              applicable fees. Fees are non-refundable except as required by law or as explicitly stated otherwise.
            </p>
            <p className="mt-4">
              We use Stripe as our payment processor. By providing payment information, you authorize us to charge 
              the applicable fees to your chosen payment method.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. User Content</h2>
            <p>
              You retain ownership of any content you upload or create on the Platform ("User Content"). By submitting 
              User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, 
              and display such content solely for the purpose of providing and improving the Platform.
            </p>
            <p className="mt-4">
              You are solely responsible for your User Content and its legality. We reserve the right to remove any 
              User Content that violates these Terms or is otherwise objectionable.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. AI-Generated Content</h2>
            <p>
              The Platform uses artificial intelligence to generate resumes, cover letters, and other career-related 
              content. While we strive for accuracy and quality, AI-generated content may contain errors or 
              inaccuracies. You are responsible for reviewing and verifying all AI-generated content before use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Prohibited Activities</h2>
            <p>You agree not to use the Platform to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the intellectual property rights of others</li>
              <li>Upload or transmit viruses or any other malicious code</li>
              <li>Attempt to gain unauthorized access to the Platform or its related systems</li>
              <li>Use the Platform for any fraudulent or deceptive purpose</li>
              <li>Interfere with the proper functioning of the Platform</li>
              <li>Harass, abuse, or harm other users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
            <p>
              The Platform and its original content, features, and functionality are owned by JobKompass and are 
              protected by international copyright, trademark, patent, trade secret, and other intellectual property 
              laws. Our trademarks and trade dress may not be used without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
            <p>
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR 
              IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY 
              DEFECTS WILL BE CORRECTED.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, JOBKOMPASS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED 
              DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Platform immediately, without prior notice 
              or liability, for any reason, including if you breach these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of any changes by posting 
              the new Terms on this page and updating the "Effective date." Your continued use of the Platform after 
              such changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, 
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="font-medium">JobKompass</p>
              <p>Email: myjobkompass@gmail.com</p>
              <p>For general inquiries, visit our <Link href="/contact" className="text-primary underline">Contact Page</Link></p>
            </div>
          </section>
        </div>
      </main>
      <JkFooter />
    </div>
  )
}
