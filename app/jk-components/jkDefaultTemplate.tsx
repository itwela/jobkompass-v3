'use client'

/**
 * Reads the signed-in user's default resume template (users.defaultTemplate, set in
 * Settings > Resume preferences). Rendered as an invisible probe inside an error boundary so
 * a backend without `auth.getDefaultTemplate` deployed yet degrades to "jake" instead of
 * crashing the screen.
 *
 *   const [tpl, setTpl] = useState<string | null>(null)
 *   <JkDefaultTemplateProbe onChange={setTpl} />
 */
import { Component, useEffect, type ReactNode } from "react"
import { useConvexAuth, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { /* backend not deployed yet: keep the app default */ }
  render() { return this.state.failed ? null : this.props.children }
}

function Probe({ onChange }: { onChange: (id: string | null) => void }) {
  const { isAuthenticated } = useConvexAuth()
  const value = useQuery(api.auth.getDefaultTemplate, isAuthenticated ? {} : "skip")
  useEffect(() => { if (value !== undefined) onChange(value) }, [value, onChange])
  return null
}

export function JkDefaultTemplateProbe({ onChange }: { onChange: (id: string | null) => void }) {
  return <Boundary><Probe onChange={onChange} /></Boundary>
}
