import { describe, expect, it } from "vitest";
import {
  docId,
  documentRank,
  resolveBaseResumeId,
  sortDocuments,
  type SortableDoc,
} from "./sortDocuments";

const doc = (over: Partial<SortableDoc> & { _id: string }): SortableDoc => ({
  documentType: "resume",
  updatedAt: 0,
  ...over,
});

describe("docId", () => {
  it("prefers _id", () => {
    expect(docId({ _id: "a", id: "b" })).toBe("a");
  });

  it("falls back to id", () => {
    expect(docId({ id: "b" })).toBe("b");
  });

  it("returns an empty string when neither is present", () => {
    expect(docId({})).toBe("");
  });
});

describe("resolveBaseResumeId", () => {
  it("returns null when no resume is active", () => {
    expect(resolveBaseResumeId([doc({ _id: "a" }), doc({ _id: "b" })])).toBeNull();
  });

  it("returns the single active resume", () => {
    expect(
      resolveBaseResumeId([doc({ _id: "a" }), doc({ _id: "b", isActive: true })])
    ).toBe("b");
  });

  it("breaks a multi-active legacy state by newest updatedAt", () => {
    expect(
      resolveBaseResumeId([
        doc({ _id: "a", isActive: true, updatedAt: 100 }),
        doc({ _id: "b", isActive: true, updatedAt: 300 }),
        doc({ _id: "c", isActive: true, updatedAt: 200 }),
      ])
    ).toBe("b");
  });

  it("ignores an active cover letter", () => {
    expect(
      resolveBaseResumeId([
        doc({ _id: "a", documentType: "cover-letter", isActive: true }),
      ])
    ).toBeNull();
  });

  it("treats a missing documentType as a resume", () => {
    expect(
      resolveBaseResumeId([{ _id: "a", isActive: true, updatedAt: 1 }])
    ).toBe("a");
  });
});

describe("documentRank", () => {
  it("ranks the base resume first", () => {
    expect(documentRank(doc({ _id: "a" }), "a")).toBe(0);
  });

  it("ranks a favorite after the base resume", () => {
    expect(documentRank(doc({ _id: "b", isFavorite: true }), "a")).toBe(1);
  });

  it("ranks a regular document last", () => {
    expect(documentRank(doc({ _id: "b" }), "a")).toBe(2);
  });

  it("lets base win when the base resume is also favorited", () => {
    expect(documentRank(doc({ _id: "a", isFavorite: true }), "a")).toBe(0);
  });

  it("has no base when baseResumeId is null", () => {
    expect(documentRank(doc({ _id: "a" }), null)).toBe(2);
  });
});

describe("sortDocuments", () => {
  it("orders base resume, then favorites, then regulars", () => {
    const docs = [
      doc({ _id: "regular" }),
      doc({ _id: "fav", isFavorite: true }),
      doc({ _id: "base", isActive: true }),
    ];
    expect(sortDocuments(docs, "base").map(docId)).toEqual([
      "base",
      "fav",
      "regular",
    ]);
  });

  it("orders newest first within the same rank", () => {
    const docs = [
      doc({ _id: "old", updatedAt: 100 }),
      doc({ _id: "new", updatedAt: 300 }),
      doc({ _id: "mid", updatedAt: 200 }),
    ];
    expect(sortDocuments(docs, null).map(docId)).toEqual(["new", "mid", "old"]);
  });

  it("breaks tied timestamps by id so order is deterministic", () => {
    const docs = [
      doc({ _id: "b", updatedAt: 100 }),
      doc({ _id: "a", updatedAt: 100 }),
    ];
    expect(sortDocuments(docs, null).map(docId)).toEqual(["a", "b"]);
  });

  it("treats a missing updatedAt as oldest", () => {
    const docs = [{ _id: "none" }, doc({ _id: "has", updatedAt: 1 })];
    expect(sortDocuments(docs, null).map(docId)).toEqual(["has", "none"]);
  });

  it("does not mutate the input array", () => {
    const docs = [doc({ _id: "b" }), doc({ _id: "a", isActive: true })];
    const before = docs.map(docId);
    sortDocuments(docs, "a");
    expect(docs.map(docId)).toEqual(before);
  });

  it("returns an empty array unchanged", () => {
    expect(sortDocuments([], null)).toEqual([]);
  });

  it("sorts a mixed resume and cover letter list together", () => {
    const docs = [
      doc({ _id: "cl", documentType: "cover-letter", updatedAt: 500 }),
      doc({ _id: "favCl", documentType: "cover-letter", isFavorite: true, updatedAt: 1 }),
      doc({ _id: "base", isActive: true, updatedAt: 1 }),
    ];
    expect(sortDocuments(docs, "base").map(docId)).toEqual([
      "base",
      "favCl",
      "cl",
    ]);
  });
});
