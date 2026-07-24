import { describe, it, expect, vi } from "vitest";
import { searchMessagesFromSender } from "./gmailClient";

function fakeGmail() {
  return {
    users: {
      messages: {
        list: vi.fn().mockResolvedValue({ data: { messages: [{ id: "m1" }, { id: "m2" }] } }),
        get: vi.fn().mockImplementation(({ id }: { id: string }) => ({
          data: {
            id,
            threadId: "t-" + id,
            snippet: "snippet " + id,
            internalDate: id === "m1" ? "200" : "100",
            payload: {
              headers: [
                { name: "Subject", value: "Sub " + id },
                { name: "Message-ID", value: "<" + id + ">" },
                { name: "From", value: "Jane <jane@acme.com>" },
              ],
            },
          },
        })),
      },
    },
  } as any;
}

describe("searchMessagesFromSender", () => {
  it("queries from:<sender> capped at max and maps fields", async () => {
    const gmail = fakeGmail();
    const out = await searchMessagesFromSender(gmail, "jane@acme.com", 3);
    expect(gmail.users.messages.list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "me", q: "from:jane@acme.com", maxResults: 3 })
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      messageId: "m1",
      threadId: "t-m1",
      subject: "Sub m1",
      snippet: "snippet m1",
      receivedAt: 200,
      rfcMessageId: "<m1>",
    });
  });

  it("returns [] when there are no messages", async () => {
    const gmail = fakeGmail();
    gmail.users.messages.list.mockResolvedValueOnce({ data: {} });
    expect(await searchMessagesFromSender(gmail, "x@y.com")).toEqual([]);
  });
});
