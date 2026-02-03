'use client'

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { mainAssets } from "../lib/constants"

export default function JkFooter() {
  return (
    <footer className="relative border-t border-border py-16 px-6" role="contentinfo">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <Image
                src={mainAssets.logo}
                alt="JobKompass Logo - Career Management Platform"
                width={36}
                height={36}
                className="object-contain relative"
              />
            </div>
            <span className="text-lg font-semibold">JobKompass</span>
          </div>
          
          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} JobKompass. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  )
}