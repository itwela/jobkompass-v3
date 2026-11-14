'use client'

import { useEffect } from "react";

/**
 * Mount once per page. Marks every [data-enter] section with data-entered the first time
 * it is on screen, which plays the .jk-enter rise on its children (see globals.css).
 */
export default function JkEnter() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("jk-enter-ready");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.setAttribute("data-entered", ""); io.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    const watch = () => document.querySelectorAll("[data-enter]:not([data-entered])").forEach((el) => io.observe(el));
    watch();
    // Sections that mount later (theme switch, client data) get picked up too.
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); root.classList.remove("jk-enter-ready"); };
  }, []);
  return null;
}
