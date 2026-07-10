import { describe, expect, it } from "vitest";

import {
  addHomeworkAttachmentInput,
  createHomeworkInput,
  listSubmissionsInput,
  mintSubmissionUploadUrlInput,
  reopenHomeworkInput,
  reviewSubmissionInput,
  submitHomeworkInput,
} from "./index";

/** M6 homework input schemas — shape/edge validation (business rules live in services). */

describe("createHomeworkInput", () => {
  const base = {
    subjectId: "sub-1",
    sectionId: "sec-1",
    title: "Read ch.3",
    dueDate: "2026-08-01",
  };

  it("accepts a minimal valid homework and transforms dueDate to a Date", () => {
    const parsed = createHomeworkInput.parse(base);
    expect(parsed.dueDate).toBeInstanceOf(Date);
  });
  it("rejects an empty title", () => {
    expect(createHomeworkInput.safeParse({ ...base, title: "  " }).success).toBe(false);
  });
  it("rejects an impossible due date", () => {
    expect(createHomeworkInput.safeParse({ ...base, dueDate: "2026-02-30" }).success).toBe(false);
  });
});

describe("submitHomeworkInput", () => {
  const base = { homeworkId: "hw-1", enrollmentId: "en-1" };

  it("defaults attachments to [] and allows a note-only submission", () => {
    const parsed = submitHomeworkInput.parse({ ...base, note: "done" });
    expect(parsed.attachments).toEqual([]);
  });
  it("accepts attachment metadata", () => {
    const ok = submitHomeworkInput.safeParse({
      ...base,
      attachments: [
        { storagePath: "s/1", fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10 },
      ],
    });
    expect(ok.success).toBe(true);
  });
  it("rejects a non-positive file size", () => {
    const bad = submitHomeworkInput.safeParse({
      ...base,
      attachments: [
        { storagePath: "s/1", fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 0 },
      ],
    });
    expect(bad.success).toBe(false);
  });
  it("rejects more than 10 attachments", () => {
    const many = Array.from({ length: 11 }, () => ({
      storagePath: "s/1",
      fileName: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
    }));
    expect(submitHomeworkInput.safeParse({ ...base, attachments: many }).success).toBe(false);
  });
});

describe("reviewSubmissionInput", () => {
  const base = { submissionId: "sub-1", body: "redo Q2" };
  it("accepts RETURNED / REVIEWED", () => {
    expect(reviewSubmissionInput.safeParse({ ...base, decision: "RETURNED" }).success).toBe(true);
    expect(reviewSubmissionInput.safeParse({ ...base, decision: "REVIEWED" }).success).toBe(true);
  });
  it("rejects SUBMITTED as a decision (not an outcome)", () => {
    expect(reviewSubmissionInput.safeParse({ ...base, decision: "SUBMITTED" }).success).toBe(false);
  });
  it("rejects an empty body", () => {
    expect(
      reviewSubmissionInput.safeParse({ ...base, decision: "REVIEWED", body: "" }).success,
    ).toBe(false);
  });
});

describe("attachment + misc inputs", () => {
  it("mintSubmissionUploadUrlInput requires a positive integer attempt", () => {
    const base = {
      homeworkId: "hw-1",
      enrollmentId: "en-1",
      fileName: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
    };
    expect(mintSubmissionUploadUrlInput.safeParse({ ...base, attempt: 1 }).success).toBe(true);
    expect(mintSubmissionUploadUrlInput.safeParse({ ...base, attempt: 0 }).success).toBe(false);
    expect(mintSubmissionUploadUrlInput.safeParse({ ...base, attempt: 1.5 }).success).toBe(false);
  });
  it("addHomeworkAttachmentInput requires mimeType + sizeBytes", () => {
    expect(
      addHomeworkAttachmentInput.safeParse({
        homeworkId: "hw-1",
        storagePath: "s/1",
        fileName: "a.pdf",
      }).success,
    ).toBe(false);
  });
  it("reopenHomeworkInput requires a non-empty reason", () => {
    expect(reopenHomeworkInput.safeParse({ homeworkId: "hw-1", reason: "" }).success).toBe(false);
  });
  it("listSubmissionsInput rejects an empty statuses array", () => {
    expect(listSubmissionsInput.safeParse({ homeworkId: "hw-1", statuses: [] }).success).toBe(
      false,
    );
  });
});
