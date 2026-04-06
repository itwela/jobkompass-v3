import JkPublicHeader from "@/app/jk-components/jkPublicHeader";
import JkFooter from "@/app/jk-components/jkFooter";

export const metadata = {
  title: "Privacy Policy | JobKompass",
  description:
    "Learn how JobKompass collects, uses, and protects your data while helping you manage your career.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <JkPublicHeader showPricing showSignIn />
      <main className="flex-1">
        <section className="py-12 px-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground mb-6">
              This Privacy Policy explains how JobKompass (&quot;we&quot;, &quot;us&quot;,
              &quot;our&quot;) collects, uses, and protects your information when you
              use our products and services.
            </p>

            <div className="space-y-6 text-sm leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
                <p className="text-muted-foreground">
                  We collect information you provide directly to us (such as account
                  details, resumes, cover letters, job applications, and feedback) as
                  well as usage data generated as you interact with the app. Some
                  features may also process documents you upload (for example resumes
                  and job descriptions) to provide AI-powered assistance.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-2">
                  2. How We Use Your Information
                </h2>
                <p className="text-muted-foreground">
                  We use your information to operate and improve JobKompass, personalize
                  your experience, generate resumes and cover letters, help you track
                  jobs, and communicate with you about updates, tips, and support. We may
                  also use aggregated, anonymized data to improve our products and
                  models.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-2">3. Data Sharing</h2>
                <p className="text-muted-foreground">
                  We do not sell your personal information. We may share data with
                  service providers and infrastructure partners strictly as needed to
                  run the app (for example, hosting, storage, analytics, or AI
                  providers), subject to appropriate data protection safeguards.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-2">4. Data Retention &amp; Security</h2>
                <p className="text-muted-foreground">
                  We keep your data only as long as necessary to provide JobKompass or as
                  required by law. We use reasonable technical and organizational
                  measures to protect your information, but no system can be guaranteed
                  100% secure.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-2">5. Your Choices</h2>
                <p className="text-muted-foreground">
                  You can update or delete certain information from within the app.
                  Depending on your region, you may have additional rights over your
                  personal data (such as access, correction, or deletion). To exercise
                  these rights, please contact us via the Contact page.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-2">6. Changes to This Policy</h2>
                <p className="text-muted-foreground">
                  We may update this Privacy Policy from time to time. If we make
                  material changes, we&apos;ll update the &quot;last updated&quot; date
                  and, where appropriate, notify you in the app or by email.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-2">7. Contact</h2>
                <p className="text-muted-foreground">
                  If you have questions about this Privacy Policy or how we handle your
                  data, please reach out through the Contact page.
                </p>
              </section>
            </div>
          </div>
        </section>
      </main>
      <JkFooter />
    </div>
  );
}

'use client'

import JkPublicHeader from "@/app/jk-components/jkPublicHeader"
import JkFooter from "@/app/jk-components/jkFooter"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground text-lg">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p>
              Welcome to JobKompass. We are committed to protecting your personal information and your right to privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our 
              career management platform.
            </p>
            <p>
              Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, 
              please do not access the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <p>We collect personal information that you voluntarily provide to us when you:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Register for an account</li>
              <li>Use our AI-powered resume and cover letter generation features</li>
              <li>Upload documents (resumes, cover letters, job descriptions)</li>
              <li>Track job applications</li>
              <li>Contact us for support</li>
              <li>Subscribe to our newsletter or waitlist</li>
            </ul>
            <p className="mt-4">The personal information we collect may include:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Name and email address</li>
              <li>Resume content and career history</li>
              <li>Job application details</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Usage data and analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, operate, and maintain our platform</li>
              <li>Improve, personalize, and expand our platform</li>
              <li>Process your transactions and manage your subscription</li>
              <li>Generate AI-powered resumes, cover letters, and career guidance</li>
              <li>Communicate with you, including customer support</li>
              <li>Send you updates, security alerts, and administrative messages</li>
              <li>Prevent fraud and ensure platform security</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures designed to protect the security 
              of any personal information we process. However, please also remember that we cannot guarantee that the 
              internet itself is 100% secure. Although we will do our best to protect your personal information, 
              transmission of personal information to and from our platform is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
            <p>
              We will only keep your personal information for as long as it is necessary for the purposes set out in 
              this privacy policy, unless a longer retention period is required or permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Your Privacy Rights</h2>
            <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The right to access and receive a copy of your personal information</li>
              <li>The right to rectify any inaccurate personal information</li>
              <li>The right to request deletion of your personal information</li>
              <li>The right to restrict or object to processing of your personal information</li>
              <li>The right to data portability</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, please contact us at the information provided below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Third-Party Services</h2>
            <p>
              We may employ third-party companies and individuals to facilitate our platform, provide the platform 
              on our behalf, perform platform-related services, or assist us in analyzing how our platform is used. 
              These third parties have access to your personal information only to perform these tasks on our behalf 
              and are obligated not to disclose or use it for any other purpose.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Children's Privacy</h2>
            <p>
              Our platform is not intended for children under 18 years of age. We do not knowingly collect personal 
              information from children under 18. If you are a parent or guardian and believe your child has provided 
              us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the 
              new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this 
              Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
            <p>
              If you have questions or comments about this Privacy Policy, please contact us at:
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
