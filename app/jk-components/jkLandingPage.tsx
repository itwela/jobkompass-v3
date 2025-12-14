'use client'

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { mainAssets } from "../constants";

export default function JkLandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src={mainAssets.logo}
            alt="JobKompass Logo"
            width={67}
            height={67}
            className="object-contain"
            priority
          />
        </div>

        {/* Hero Section */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            Welcome to JobKompass
          </h1>
          <p className="text-xl text-muted-foreground">
            Your intelligent career companion for managing jobs, resumes, and applications.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Link href="/app">
            <Button size="lg" className="text-lg px-8 py-6">
              Enter JobKompass
            </Button>
          </Link>
          <Link href="/waitlist">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6">
              Join Waitlist
            </Button>
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-sm text-muted-foreground pt-8">
          Sign up to be notified when we launch new features
        </p>
      </div>
    </div>
  );
}
