# MegaExams parity integration plan

## Objective

Integrate the useful MegaExams-style assessment workflow into the existing Jaystarbliss portal. This is a clean-room implementation based on observable product behavior and published feature descriptions; do not copy MegaExams proprietary source, branding, private APIs, or assets. REA is an analysis aid, not a dependency of the deployed portal.

## Existing foundation found on `main`

The repository already contains a JDI examination subsystem:
- Tutor/admin authoring workspace and numbered-question/answer-key parser.
- School-scoped exams and reusable question-bank endpoint.
- Student exam list, passcode activation, timed attempts, server-side answer handling and grading.
- Examination history with manual grading/result-release controls and audit history.
- XLSX export and client-generated PDF/ZIP report utilities.
- School learner reporting workspace added in the recent school-scope work.

This is a source audit, not proof of production deployment or end-to-end behavior. Validate with build, rules tests, and real role accounts before release.

## Feature comparison

| Capability | Current repository evidence | Integration decision |
|---|---|---|
| Timed exams, activation windows, passcodes, attempt limits | Present in JDI exam functions/UI | Harden and regression-test |
| Question authoring from pasted numbered script and answer key | Present in `parseExamScript.ts` | Keep the non-AI workflow; add actionable validation |
| Question bank | `jdi-question-bank.ts` and tutor authoring UI | Preserve school isolation; improve reuse and authoring UX |
| Automatic grading and manual marking | Present in attempt/history code | Verify per-type scoring and release states |
| Student test list and timed player | Student examination routes/components | Validate autosave, reconnect, expiry, and safe payloads |
| School → class → test reporting | School-scoped examination history/reporting | Ensure stable school IDs and class filters are used server-side |
| Parent-specific examination results | Added a parent-only server endpoint and read-only parent portal page on this branch | Validate against real parent/child records and result-release data |
| Staff/tutor authoring and grading | Tutor workspace and server endpoints | Enforce assigned-school/student permissions, not client-supplied scope |
| Admin oversight | Admin routes share the examination workspace | Ensure privileged admin access is explicit and audited |
| Branded individual PDFs, bulk ZIP, XLSX export | Utilities and history UI exist | Verify totals, school branding, privacy and large-class handling |
| Result-release controls and audit history | Present in history UI/code | Verify notifications are recipient-specific and do not leak results |
| DOCX/XLSX/CSV question import | Not evidenced in the inspected authoring UI | Candidate later phase; only add with parser/preview/validation tests |
| Numeric, match-pairs, ordering question types | Current domain types list single/multiple choice, true/false, short answer, essay | Extend only with end-to-end authoring, safe payload, save, grading and report support |
| Math/LaTeX rendering and question images | Not evidenced in current question model/player | Candidate later phase after safe rendering and export parity |
| Public ready-made paper library, city-wide public rankings, personalized practice, course unlock sequences | Not evidenced as integrated features | Defer until the core portal journey and data governance are verified |
| AI question generation / AI essay grading | Excluded from the current agreed v1 scope | Do not introduce without a new explicit scope decision |
| Webcam proctoring, fullscreen lock, tab-locking | Excluded from the current agreed v1 scope | Do not introduce in this phase |

## Role contract

- **Student:** see only assigned tests; start only when eligible; answer and submit; see own results only after release.
- **Parent:** read-only view of linked children and their released exam results; never author, alter marks, or see other learners.
- **School admin:** view only the school's roster, classes, exam history, attendance/activity where already supported, and school reports; a school is not a learner account.
- **Tutor/staff:** author and manage tests only for schools/classes/students they are assigned to; grade and release only within that scope.
- **Admin:** platform-wide oversight through explicitly privileged server-side authorization, with audit events for sensitive changes.

## Non-negotiable engineering checks

1. Derive identity from verified Firebase ID tokens; never trust client-supplied student or school IDs for authorization.
2. Never return answer keys, accepted answers, passcode hashes, or unreleased marks in student payloads.
3. Enforce assignment, school/class membership, activation window, attempt limit, deadline and release state on the server.
4. Keep school and parent-child scoping server-side; fail closed on ambiguous legacy IDs.
5. Keep the existing portal's authentication, design system, and shared records; do not create a parallel user/school database.
6. Run lint, production build, serverless typecheck and Firestore rules tests. Then test student, parent, school, tutor/staff and admin journeys with separate real accounts before declaring production readiness.
7. Do not claim production is updated until the deployment is verified.

## Work sequence

1. Finish the role-by-role journey and security audit against the current source.
2. Fix core journey gaps and authoring validation first.
3. Integrate parent released-result views and verify school/class reporting scope.
4. Add and test any extra question types/import formats as a complete vertical slice, not just a UI option.
5. Validate exports, notifications, audit history, error states, and mobile exam-player behavior.
6. Run CI and authenticated acceptance tests; then prepare a controlled production release.
