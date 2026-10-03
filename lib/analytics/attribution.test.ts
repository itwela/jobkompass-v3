import { describe, expect, it } from "vitest";
import { captureFirstTouch, readFirstTouch, type StorageLike } from "./attribution";

function memoryStorage(): StorageLike & { dump: () => string | null } {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    dump: () => value,
  };
}

describe("first-touch attribution", () => {
  it("stores utm params and the referring host, then refuses to overwrite them", () => {
    const storage = memoryStorage();
    const first = captureFirstTouch(storage, {
      search: "?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
      referrer: "https://news.ycombinator.com/item?id=1&email=ada@example.com",
      path: "/pricing?utm_source=newsletter",
      host: "myjobkompass.com",
    });

    expect(first).toMatchObject({
      utm_source: "newsletter",
      utm_medium: "email",
      utm_campaign: "launch",
      referrer_host: "news.ycombinator.com",
      landing_path: "/pricing",
    });
    expect(storage.dump()).not.toContain("ada@");
    expect(storage.dump()).not.toContain("item");

    const second = captureFirstTouch(storage, {
      search: "?utm_source=override",
      referrer: "https://evil.example/path",
      path: "/other",
      host: "myjobkompass.com",
    });
    expect(second?.utm_source).toBe("newsletter");
    expect(readFirstTouch(storage)?.landing_path).toBe("/pricing");
  });

  it("drops a same-site referrer and an email stuffed into a utm param", () => {
    const storage = memoryStorage();
    const touch = captureFirstTouch(storage, {
      search: "?utm_source=ada@example.com",
      referrer: "https://myjobkompass.com/app",
      path: "/",
      host: "myjobkompass.com",
    });
    expect(touch?.utm_source).toBeUndefined();
    expect(touch?.referrer_host).toBeUndefined();
    expect(JSON.stringify(touch)).not.toContain("ada@");
  });
});
