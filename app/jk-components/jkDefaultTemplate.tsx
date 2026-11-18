'use client'

/**
 * Reads the signed-in user's default resume template (users.defaultTemplate, set in
 * Settings > Resume preferences). Rendered as an invisible probe so a backend without `auth.getDefaultTemplate` deployed yet degrades to "jake" instead of
 * crashing the screen.
 *
 *   const [tpl, setTpl] = useState<string | null>(null)
 *   <JkDefaultTemplateProbe onChange={setTpl} />
 */
import { useEffect } from "react"
import { useConvex, useConvexAuth } from "convex/react"
import { api } from "@/convex/_generated/api"

// A one-shot query (not useQuery): useQuery throws into React when the function isn't
// deployed, which the dev overlay shows as a crash even inside an error boundary.
// The probe remounts with each screen, so a read on mount is fresh enough.
export function JkDefaultTemplateProbe({ onChange }: { onChange: (id: string | null) => void }) {
  const convex = useConvex()
  const { isAuthenticated } = useConvexAuth()
  useEffect(() => {
    if (!isAuthenticated) return
    let live = true
    convex.query(api.auth.getDefaultTemplate, {}).then((v) => { if (live) onChange(v) }, () => { /* not deployed yet: keep the app default */ })
    return () => { live = false }
  }, [convex, isAuthenticated, onChange])
  return null
}
