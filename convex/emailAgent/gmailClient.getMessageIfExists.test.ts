import { describe, it, expect, vi } from "vitest";
import { getMessageIfExists } from "./gmailClient";

function gmailReturning(get: any) {
  return { users: { messages: { get } } } as any;
}

function gmailError(status: number, message: string) {
  const error: any = new Error(message);
  error.code = status;
  error.status = status;
  error.response = { status };
  return error;
}

describe("getMessageIfExists", () => {
  it("returns the parsed message when it exists", async () => {
    const gmail = gmailReturning(
      vi.fn().mockResolvedValue({
        data: {
          id: "m1",
          threadId: "t1",
          snippet: "hello",
          internalDate: "1700000000000",
          payload: {
            headers: [
              { name: "Subject", value: "Interview?" },
              { name: "From", value: "Jane <jane@acme.com>" },
              { name: "Message-ID", value: "<abc>" },
            ],
          },
        },
      })
    );

    const message = await getMessageIfExists(gmail, "m1");
    expect(message).toMatchObject({ id: "m1", threadId: "t1", subject: "Interview?" });
  });

  it("returns null when Gmail 404s a message that no longer exists", async () => {
    // Gmail's history feed still lists messages that have since been permanently
    // deleted; messages.get then 404s. That must not abort the whole scan.
    const gmail = gmailReturning(
      vi.fn().mockRejectedValue(gmailError(404, "Requested entity was not found."))
    );

    expect(await getMessageIfExists(gmail, "19f5322cc31542ed")).toBeNull();
  });

  it("rethrows non-404 failures so real outages still surface", async () => {
    const gmail = gmailReturning(
      vi.fn().mockRejectedValue(gmailError(500, "Backend Error"))
    );

    await expect(getMessageIfExists(gmail, "m1")).rejects.toThrow("Backend Error");
  });
});
