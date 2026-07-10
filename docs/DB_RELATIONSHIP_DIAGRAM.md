# Database Relationship Diagram — School Management Portal

Visual companion to Dev PRD §6 (the schema there is the source of truth). Mermaid ER diagram of the **full target schema** (all milestones + add-ons). Milestone tags show when each model's migration lands (numbering per REVIEW_FINDINGS A1 — code numbering: M1 auth, M2 people, …).

## Legend

- `||--o{` one-to-many · `||--||` one-to-one · `}o--o{` many-to-many (via join model)
- **Loose refs** (deliberately no FK): `schoolId` everywhere (ADR-008), `AuditLog`/`ImportJob` actor+entity (ADR-007), `Announcement.targetId` (polymorphic). Shown as dashed notes, not edges.
- Partial unique indexes (raw SQL in migrations): `ReportCard(enrollmentId, examId) WHERE examId IS NOT NULL` (ADR-009), `GuardianStudent(studentId) WHERE isPrimary`, and `AcademicYear(schoolId) WHERE isCurrent` (adopted v1.3 — exactly one current year).

## Identity & people (M1–M2)

```mermaid
erDiagram
    USER ||--o| STAFF : "profile (1:1, cascade)"
    USER ||--o| GUARDIAN : "profile (1:1, cascade)"
    USER ||--o{ DEVICE_TOKEN : "cascade"
    USER ||--o{ NOTIFICATION : "cascade"
    GUARDIAN ||--o{ GUARDIAN_STUDENT : "cascade"
    STUDENT ||--o{ GUARDIAN_STUDENT : "cascade"

    USER {
        string id PK "== Supabase auth UID"
        string schoolId "loose"
        enum role "SUPER_ADMIN|OFFICE_ADMIN|TEACHER|PARENT|ACCOUNTANT"
        string phone UK "nullable"
        string email UK "nullable"
        enum status "INVITED|ACTIVE|DISABLED"
        enum locale "EN|ML"
    }
    STAFF { string userId FK,UK "" }
    GUARDIAN { string userId FK,UK "" }
    STUDENT { string admissionNo UK "" }
    GUARDIAN_STUDENT {
        string guardianId PK,FK ""
        string studentId PK,FK ""
        bool isPrimary "partial-unique per student"
    }
```

## Academic structure & enrollment (M2)

```mermaid
erDiagram
    ACADEMIC_YEAR ||--o{ CLASS_SUBJECT : ""
    ACADEMIC_YEAR ||--o{ ENROLLMENT : ""
    ACADEMIC_YEAR ||--o{ EXAM : ""
    CLASS_LEVEL ||--o{ DIVISION : ""
    CLASS_LEVEL ||--o{ CLASS_SUBJECT : ""
    CLASS_LEVEL ||--o{ ENROLLMENT : ""
    SUBJECT ||--o{ CLASS_SUBJECT : ""
    DIVISION ||--o{ TEACHER_ASSIGNMENT : ""
    DIVISION ||--o{ ENROLLMENT : ""
    CLASS_SUBJECT ||--o{ TEACHER_ASSIGNMENT : "optional"
    STAFF ||--o{ TEACHER_ASSIGNMENT : "cascade"
    STUDENT ||--o{ ENROLLMENT : ""

    ACADEMIC_YEAR { bool isCurrent "exactly one — partial unique idx (v1.3)" }
    HOLIDAY {
        date date "school calendar (v1.3, Dev PRD 8.19)"
        string classLevelId "nullable scope"
        string id "UK(schoolId, date, classLevelId)"
    }
    DIVISION { string name "UK(classLevelId, name)" }
    CLASS_SUBJECT { string id "UK(classLevelId, subjectId, academicYearId)" }
    TEACHER_ASSIGNMENT { string note "NO isClassTeacher flag — class teacher is the dedicated ClassTeacherAssignment (M6.5, ADR-015)" }
    ENROLLMENT {
        enum status "ADMITTED..ALUMNI lifecycle"
        string id "UK(studentId, academicYearId)"
    }
```

## Attendance & leave (M3 attendance, M5 leave)

```mermaid
erDiagram
    ENROLLMENT ||--o{ ATTENDANCE : ""
    STAFF ||--o{ ATTENDANCE : "markedBy"
    STUDENT ||--o{ LEAVE_APPLICATION : "year-independent"
    USER ||--o{ LEAVE_APPLICATION : "appliedBy"
    STAFF ||--o{ LEAVE_APPLICATION : "decidedBy (nullable)"

    ATTENDANCE {
        date date "IST calendar date — @db.Date (decided v1.3)"
        int period "0 = whole day; 1..N period-wise"
        enum status "PRESENT|ABSENT|HALF_DAY|LEAVE|HOLIDAY"
        string id "UK(enrollmentId, date, period)"
    }
    LEAVE_APPLICATION {
        enum status "PENDING|APPROVED|REJECTED|CANCELLED"
        date fromDate ""
        date toDate ""
    }
```

Leave→Attendance bridge (no FK): on APPROVED, service resolves `studentId → current ACTIVE Enrollment` and upserts `Attendance(LEAVE)` per school day (§8.7; school-day source = calendar model, REVIEW_FINDINGS B1).

## Exams, marks, report cards (M4)

```mermaid
erDiagram
    ACADEMIC_YEAR ||--o{ EXAM : ""
    EXAM ||--o{ EXAM_SUBJECT : "cascade"
    CLASS_SUBJECT ||--o{ EXAM_SUBJECT : ""
    EXAM_SUBJECT ||--o{ MARK : ""
    ENROLLMENT ||--o{ MARK : ""
    STAFF ||--o{ MARK : "enteredBy"
    GRADE_SCALE ||--o{ GRADE_BAND : "cascade"
    GRADE_BAND ||--o{ MARK : "optional"
    ENROLLMENT ||--o{ REPORT_CARD : ""
    EXAM ||--o{ REPORT_CARD : "OPTIONAL (ADR-009)"

    EXAM_SUBJECT { string id "UK(examId, classSubjectId)" }
    MARK {
        float theory "nullable"
        float practical "nullable"
        bool isAbsent ""
        string id "UK(examSubjectId, enrollmentId)"
        datetime updatedAt "conflict detection"
    }
    GRADE_BAND { string grade "A+..E configurable" }
    REPORT_CARD {
        string examId "nullable — partial UK WHERE NOT NULL"
        string pdfPath "private storage PATH, signed on read (v1.3)"
    }
```

## Homework & submissions (M6 — IMPLEMENTED per ADR-013)

> This section reflects the **implemented** schema (`20260710000000_homework_management`),
> which supersedes the Dev PRD §8.6 distribution-only sketch below (the `HOMEWORK`
> entity under "Communication & notifications" — `DIVISION`-era vocabulary, no
> submissions). The M6 brief made parent submissions **core**; ADR-013 is the source
> of truth. Delete rules **live-verified** M6 Step 3 (rollback-safe probes R1–R10:
> 17/17 FK rules exact, promotion/transfer history preservation, cascade precision,
> durable actors, guarded-transition primitives, zero probe rows persisted).

```mermaid
erDiagram
    ACADEMIC_YEAR ||--o{ HOMEWORK : "restrict — year stamped at creation (cross-year boundary)"
    SUBJECT ||--o{ HOMEWORK : "restrict — always subject-bound"
    SECTION ||--o{ HOMEWORK : "restrict"
    STAFF ||--o{ HOMEWORK : "createdBy / publishedBy? / closedBy? / reopenedBy? — all restrict (audit actors, not owners)"
    HOMEWORK ||--o{ HOMEWORK_ATTACHMENT : "CASCADE (teacher files = content)"
    STAFF ||--o{ HOMEWORK_ATTACHMENT : "uploadedBy restrict"
    HOMEWORK ||--o{ HOMEWORK_SUBMISSION : "CASCADE (delete business-guarded to DRAFT — structurally submission-free)"
    ENROLLMENT ||--o{ HOMEWORK_SUBMISSION : "restrict — NEVER Student (ADR-010 §8)"
    PARENT ||--o{ HOMEWORK_SUBMISSION : "submittedBy restrict — parents submit, no student login"
    STAFF ||--o{ HOMEWORK_SUBMISSION : "reviewedBy? restrict"
    HOMEWORK_SUBMISSION ||--o{ SUBMISSION_ATTACHMENT : "CASCADE (append-only, attempt-tagged)"
    PARENT ||--o{ SUBMISSION_ATTACHMENT : "uploadedBy restrict"
    HOMEWORK_SUBMISSION ||--o{ HOMEWORK_FEEDBACK : "CASCADE (immutable review rounds)"
    STAFF ||--o{ HOMEWORK_FEEDBACK : "author restrict"

    HOMEWORK {
        date dueDate "IST @db.Date; extend-only once PUBLISHED (service)"
        enum status "DRAFT|PUBLISHED|CLOSED — CHECK: DRAFT iff no publish stamp, CLOSED iff close stamp (reopen clears it)"
        string reopenReason "audited reopen = the one backward transition (M5 unlock analog)"
        string id "no natural key — duplicate titles legal (deliberate)"
    }
    HOMEWORK_ATTACHMENT { string storagePath "PRIVATE homework-files path, signed on read (ADR-004)" }
    HOMEWORK_SUBMISSION {
        enum status "SUBMITTED|RETURNED|REVIEWED — CHECK: decision states carry reviewedBy/At"
        int attempt "CHECK >= 1; resubmit = in-place attempt++ on the SAME row"
        bool isLate "snapshot at latest (re)submit vs dueDate — no cron"
        string id "UK(homeworkId, enrollmentId) — duplicate race is a DB error; holds across transfer (R3)"
    }
    SUBMISSION_ATTACHMENT { int attempt "CHECK >= 1 — history never deleted on resubmit" }
    HOMEWORK_FEEDBACK {
        enum decision "RETURNED|REVIEWED only — CHECK <> SUBMITTED"
        int attempt "which attempt this round judged (snapshot)"
        string body "text only — NO score/grade (grading out of scope)"
    }
```

Cross-table invariants **not** in the DB (service layer, ADR-013 §7): section match,
year match, ACTIVE enrollment, StudentParent link, PUBLISHED-only submission.
Ownership derives from `TeacherAssignment(teacher, subject, section)` at authz time —
no owner column to rot.

## Communication & notifications (M5-planned — NOT built)

> The `HOMEWORK` entity in this sketch is **superseded by the implemented M6 model
> above** (distribution-only → full submissions; brief overrides Dev PRD decision #13).
> Messages/announcements remain future work.

```mermaid
erDiagram
    STAFF ||--o{ MESSAGE_THREAD : ""
    GUARDIAN ||--o{ MESSAGE_THREAD : ""
    STUDENT ||--o{ MESSAGE_THREAD : "optional context"
    MESSAGE_THREAD ||--o{ MESSAGE : "cascade"
    USER ||--o{ MESSAGE : "sender"
    USER ||--o{ ANNOUNCEMENT : "createdBy"
    DIVISION ||--o{ HOMEWORK : ""
    CLASS_SUBJECT ||--o{ HOMEWORK : "optional"
    STAFF ||--o{ HOMEWORK : "createdBy"

    MESSAGE_THREAD { string id "strictly 1:1 staff-guardian (B12)" }
    MESSAGE { datetime readAt "single recipient" }
    ANNOUNCEMENT {
        enum scope "SCHOOL|CLASS|DIVISION"
        string targetId "LOOSE polymorphic: ClassLevel or Division id"
    }
    HOMEWORK { string attachmentUrls "storage paths (B7) — SUPERSEDED by M6 section above" }
```

## Ops, flags, add-ons (M1 audit/flags; add-ons behind flags)

```mermaid
erDiagram
    FEE_STRUCTURE ||--o{ FEE_ITEM : "cascade"
    FEE_STRUCTURE ||--o{ INVOICE : ""
    ACADEMIC_YEAR ||--o{ FEE_STRUCTURE : ""
    CLASS_LEVEL ||--o{ FEE_STRUCTURE : "optional"
    STUDENT ||--o{ INVOICE : ""
    INVOICE ||--o{ INVOICE_LINE : "cascade"
    FEE_ITEM ||--o{ INVOICE_LINE : ""
    INVOICE ||--o{ PAYMENT : ""
    DIVISION ||--o{ TIMETABLE_PERIOD : ""
    CLASS_SUBJECT ||--o{ TIMETABLE_PERIOD : "optional"
    STAFF ||--o{ TIMETABLE_PERIOD : "optional"

    INVOICE { enum status "PENDING|PARTIAL|PAID|OVERDUE|CANCELLED" }
    PAYMENT {
        enum status "CREATED|CAPTURED|FAILED|REFUNDED"
        string razorpayOrderId "indexed for webhook"
        int amount "paise"
    }
    TIMETABLE_PERIOD { string id "UK(divisionId, dayOfWeek, periodNo)" }
```

Standalone (loose refs only): `SCHOOL` (tenant root), `AUDIT_LOG(actorUserId, entityType, entityId, before/afterJson)`, `IMPORT_JOB`, `FEATURE_FLAG(UK schoolId+key)`.

**Adopted v1.3:** `Holiday(schoolId, date, name, classLevelId?)` + working-weekday config in typed `SchoolSettings` (Dev PRD §8.19) — the school-day source of truth for leave approval and the absence job. Storage fields are now `*Path` (`logoPath`, `photoPath`, `pdfPath`, `attachmentPaths`, `filePath`) per decision #24.

## onDelete policy summary (DATABASE_CONVENTIONS §7)

| Cascade (composition) | Restrict (history/money) |
|---|---|
| Staff/Guardian→User, GuardianStudent, DeviceToken, Notification, GradeBand→Scale, ExamSubject→Exam, Message→Thread, FeeItem→Structure, InvoiceLine→Invoice, **M6:** HomeworkAttachment→Homework, HomeworkSubmission→Homework (delete business-guarded to DRAFT), SubmissionAttachment→Submission, HomeworkFeedback→Submission | Mark, Attendance, Enrollment, Invoice, Payment, ReportCard, LeaveApplication, all academic structure, **M6:** Submission→Enrollment/Parent, every homework Staff/Parent actor, Homework→Year/Subject/Section |

**M6 note:** the homework tables use **no SetNull** — verified live (R1: 17/17 FK
delete rules exact; only Cascade content edges + Restrict data/actor edges).
