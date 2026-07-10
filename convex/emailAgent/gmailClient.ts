"use node";

import { google, gmail_v1 } from "googleapis";

type Account = {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
};

export async function getGmailClient(account: Account) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiresAt,
  });

  let refreshedAccessToken: string | undefined;
  let refreshedExpiresAt: number | undefined;

  if (account.tokenExpiresAt < Date.now() + 60_000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    refreshedAccessToken = credentials.access_token ?? undefined;
    refreshedExpiresAt = credentials.expiry_date ?? undefined;
  }

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  return { gmail, refreshedAccessToken, refreshedExpiresAt };
}

export async function listNewMessageIds(
  gmail: gmail_v1.Gmail,
  sinceHistoryId?: string
): Promise<{ messageIds: string[]; newHistoryId: string }> {
  const profile = await gmail.users.getProfile({ userId: "me" });
  const newHistoryId = String(profile.data.historyId);

  const firstPollFallback = async () => {
    // First poll for this account (or re-seed after a stale/expired historyId): just grab
    // recent inbox mail (last 14 days), don't backfill from the dawn of time.
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "in:inbox newer_than:14d",
      maxResults: 50,
    });
    return { messageIds: (list.data.messages || []).map((m) => m.id!), newHistoryId };
  };

  if (!sinceHistoryId) {
    return firstPollFallback();
  }

  try {
    const history = await gmail.users.history.list({
      userId: "me",
      startHistoryId: sinceHistoryId,
      historyTypes: ["messageAdded"],
    });

    const ids = new Set<string>();
    for (const record of history.data.history || []) {
      for (const added of record.messagesAdded || []) {
        if (added.message?.id) ids.add(added.message.id);
      }
    }
    return { messageIds: Array.from(ids), newHistoryId };
  } catch (error: any) {
    // Gmail expires historyId after ~1 week (sooner for very active mailboxes) and returns
    // 404 for a too-old startHistoryId. Re-seed by falling back to the same "first poll"
    // path, so the caller persists a fresh historyId and doesn't hit the same 404 forever.
    if (error?.code === 404) {
      console.warn(
        `Stale historyId (${sinceHistoryId}) for Gmail account; re-seeding via full list.`
      );
      return firstPollFallback();
    }
    throw error;
  }
}

export async function getMessage(gmail: gmail_v1.Gmail, messageId: string) {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = res.data.payload?.headers || [];
  const header = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  const bodyText = extractPlainText(res.data.payload);

  return {
    id: res.data.id!,
    threadId: res.data.threadId!,
    rfcMessageId: header("Message-ID"),
    from: header("From"),
    subject: header("Subject"),
    snippet: res.data.snippet || "",
    bodyText,
  };
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  for (const part of payload.parts || []) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  return "";
}

export async function sendReply(
  gmail: gmail_v1.Gmail,
  params: {
    to: string;
    subject: string;
    bodyText: string;
    threadId: string;
    inReplyTo: string; // rfcMessageId of the original
    attachment?: { filename: string; content: Buffer; mimeType: string };
  }
): Promise<{ sentMessageId: string }> {
  const boundary = `boundary_${Date.now()}`;
  const subjectLine = params.subject.startsWith("Re:") ? params.subject : `Re: ${params.subject}`;

  let raw = "";
  raw += `To: ${params.to}\r\n`;
  raw += `Subject: ${subjectLine}\r\n`;
  raw += `In-Reply-To: ${params.inReplyTo}\r\n`;
  raw += `References: ${params.inReplyTo}\r\n`;
  raw += `MIME-Version: 1.0\r\n`;
  raw += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
  raw += `--${boundary}\r\n`;
  raw += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
  raw += `${params.bodyText}\r\n\r\n`;

  if (params.attachment) {
    raw += `--${boundary}\r\n`;
    raw += `Content-Type: ${params.attachment.mimeType}; name="${params.attachment.filename}"\r\n`;
    raw += `Content-Disposition: attachment; filename="${params.attachment.filename}"\r\n`;
    raw += `Content-Transfer-Encoding: base64\r\n\r\n`;
    raw += `${params.attachment.content.toString("base64")}\r\n\r\n`;
  }
  raw += `--${boundary}--`;

  const encodedMessage = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage, threadId: params.threadId },
  });

  return { sentMessageId: res.data.id! };
}
