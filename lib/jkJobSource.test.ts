import { describe, expect, it } from "vitest"
import { jobSource } from "./jkJobSource"

describe("jobSource", () => {
  it("reads a Gmail link with inbox, sender and date from the notes", () => {
    const s = jobSource({
      link: "https://mail.google.com/mail/u/0/#all/1a1fae",
      notes: "SOURCE: Dice private email, deanandnostrand@gmail.com, 2026-11-20 4:34 PM ET. Recruiter Satyendra Pandey <satyendra.pandey@eniacsys.com>",
    })
    expect(s.kind).toBe("gmail")
    expect(s.inbox).toBe("deanandnostrand@gmail.com")
    expect(s.sender).toBe("Satyendra Pandey <satyendra.pandey@eniacsys.com>")
    expect(s.received).toBe("2026-11-20 4:34 PM ET")
  })

  it("reads an Outlook link", () => {
    const s = jobSource({
      link: "https://outlook.cloud.microsoft/mail/inbox/id/AAQ",
      notes: "SOURCE: WGU Outlook (iibomu@wgu.edu), Thu Nov 19, 2026 12:35 PM ET, from Utkarsh, Galactic Mind <utkarsh@galacticmind.com>",
    })
    expect(s.kind).toBe("outlook")
    expect(s.inbox).toBe("iibomu@wgu.edu")
    expect(s.received).toBe("Thu Nov 19, 2026 12:35 PM ET")
    expect(s.sender).toBe("Galactic Mind <utkarsh@galacticmind.com>")
  })

  it("treats a posting link as web and names known boards", () => {
    expect(jobSource({ link: "https://job-boards.greenhouse.io/fleetio/jobs/1" })).toMatchObject({ kind: "web", site: "Greenhouse" })
    expect(jobSource({ link: "https://www.amazon.jobs/en/jobs/10472274" })).toMatchObject({ kind: "web", site: "Amazon Jobs", host: "amazon.jobs" })
    expect(jobSource({ link: "https://ncr.wd1.myworkdayjobs.com/x" })).toMatchObject({ kind: "web", site: "Workday" })
    expect(jobSource({ link: "https://mechanize.work/apply" })).toMatchObject({ kind: "web", site: "mechanize.work" })
  })

  it("has no source for empty, broken or meeting links", () => {
    expect(jobSource({ link: "" }).kind).toBe("none")
    expect(jobSource({ link: "not a url" }).kind).toBe("none")
    expect(jobSource({ link: "https://meet.google.com/pqx-kxor-tyj" }).kind).toBe("none")
  })

  it("does not take a month name as the sender", () => {
    const s = jobSource({ link: "https://mail.google.com/x", notes: "Nov 20, 2026: recruiter Anurag Mohan <anurag.m@saxonglobal.com> emailed" })
    expect(s.sender).toBe("Anurag Mohan <anurag.m@saxonglobal.com>")
  })
})

import { buildJobSource, deriveJobSource } from "./jkJobSource"

describe("buildJobSource (stored on new jobs)", () => {
  it("fills an email job from the link and notes when the caller says nothing", () => {
    const s = buildJobSource({ link: "https://mail.google.com/mail/u/0/#all/1", notes: "deanandnostrand@gmail.com, 2026-11-20 4:34 PM ET, Jane Doe <jane@agency.com>" })
    expect(s).toEqual({ kind: "gmail", inbox: "deanandnostrand@gmail.com", sender: "Jane Doe <jane@agency.com>", received: "2026-11-20 4:34 PM ET", url: "https://mail.google.com/mail/u/0/#all/1" })
  })

  it("lets the caller's details win and names the app from the link", () => {
    const s = buildJobSource({ link: "https://outlook.cloud.microsoft/mail/x", notes: "" }, { kind: "email", inbox: "iibomu@wgu.edu", sender: "Utkarsh <u@g.com>", received: "Nov 19" })
    expect(s).toMatchObject({ kind: "outlook", inbox: "iibomu@wgu.edu", sender: "Utkarsh <u@g.com>", received: "Nov 19" })
  })

  it("keeps an email from a posting link as email, with the posting to open", () => {
    const s = buildJobSource({ link: "https://jobs.lever.co/acme/1" }, { kind: "email", inbox: "me@gmail.com" })
    expect(s).toEqual({ kind: "email", inbox: "me@gmail.com", url: "https://jobs.lever.co/acme/1" })
  })

  it("marks extension saves with the site", () => {
    expect(buildJobSource({ link: "https://www.linkedin.com/jobs/view/1" }, { kind: "extension" })).toMatchObject({ kind: "extension", site: "LinkedIn", host: "linkedin.com" })
  })

  it("never stores undefined fields", () => {
    const s = buildJobSource({ link: "" })
    expect(s).toEqual({ kind: "none" })
    expect(Object.values(buildJobSource({ link: "https://x.com/j" })).every((v) => v !== undefined)).toBe(true)
  })

  it("prefers a stored source over reading the link", async () => {
    const { jobSource } = await import("./jkJobSource")
    expect(jobSource({ link: "https://mail.google.com/x", source: { kind: "extension" } }).kind).toBe("extension")
    expect(deriveJobSource({ link: "https://mail.google.com/x" }).kind).toBe("gmail")
  })
})
