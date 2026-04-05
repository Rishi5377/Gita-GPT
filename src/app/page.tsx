"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="max-w-2xl"
      >
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl text-primary shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            🕉
          </div>
        </div>

        <h1 className="mb-4 font-playfair text-5xl font-medium tracking-tight md:text-7xl">
          Gita Mirror
        </h1>
        
        <p className="mb-12 text-lg text-muted-foreground md:text-xl font-light tracking-wide">
          A space to reflect — not to receive answers, but to find them within.
        </p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          <Link
            href="/chat"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-8 py-4 text-primary-foreground transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
          >
            <span className="relative z-10 font-medium tracking-wider">BEGIN REFLECTION</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 -translate-x-full group-hover:translate-x-full" />
          </Link>
        </motion.div>

        <p className="mt-16 text-xs font-light uppercase tracking-[0.2em] text-muted-foreground/40">
          Rooted in the eternal wisdom of the Bhagavad Gita
        </p>
      </motion.div>

      {/* Subtle decorative elements */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </main>
  );
}
