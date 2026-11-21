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
