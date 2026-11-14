import dns from "node:dns/promises";
import net from "node:net";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 9000;
const MAX_REDIRECTS = 4;

/** True for loopback, private, link-local, CGNAT and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

/** Accepts "careers.x.com/job/1" or a full URL; returns a public http(s) URL or null. */
export function normalizeJobUrl(input: string): URL | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") || url.username || url.password) return null;
    if (net.isIP(url.hostname) && isPrivateAddress(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function assertPublicHost(url: URL) {
  const addrs = await dns.lookup(url.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("blocked host");
}

/** Visible text of an HTML page, plus JSON-LD JobPosting data when the page has it. */
export function htmlToText(html: string): string {
  const ld: string[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/JobPosting/i.test(m[1])) ld.push(m[1].trim().slice(0, 20000));
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return [title.trim() && `Page title: ${title.trim()}`, ld.length ? `Structured data:\n${ld.join("\n")}` : "", body].filter(Boolean).join("\n\n").slice(0, 40000);
}

/**
 * Fetches a job posting server-side. Refuses private/internal hosts (checked again
 * on every redirect) so the route can't be used to reach our own network.
 * Returns null when the page can't be read (blocked, login wall, too little text).
 */
export async function fetchPostingText(input: string): Promise<{ url: string; text: string } | null> {
  const first = normalizeJobUrl(input);
  if (!first) return null;
  let url: URL = first;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(url);
      const res: Response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        const resolved = next ? normalizeJobUrl(new URL(next, url).toString()) : null;
        if (!resolved) return null;
        url = resolved;
        continue;
      }
      if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) return null;
      const reader = res.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) { await reader.cancel(); break; }
        chunks.push(value);
      }
      const text = htmlToText(Buffer.concat(chunks).toString("utf8"));
      // Login walls and JS-only shells come back nearly empty.
      return text.replace(/\s+/g, " ").length >= 400 ? { url: url.toString(), text } : null;
    }
    return null;
  } catch {
    return null;
  }
}
