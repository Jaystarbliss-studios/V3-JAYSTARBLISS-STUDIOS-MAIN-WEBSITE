# JDI examination security contract

Brand education portal surfaces and reports as **JAYSTARBLISS DYNAMIC INSTITUTE (JDI)**. Jaystarbliss Studios remains the organisation/developer brand.

## Mandatory passcode validation
- Never validate a passcode only in React or expose passcodes in student-readable Firestore documents.
- Verify Firebase ID tokens on the server and derive the student UID from the verified token; never trust a client-supplied student ID.
- Check role/account status, school/class membership, exam assignment, status, activation window, expiry, prior attempt and attempt limits on the server.
- Store only salted cryptographic passcode hashes; compare in constant time. Use high-entropy codes where possible. Short numeric codes require short expiry and strict rate limiting.
- Apply per-user and per-exam rate limits, backoff after failures, and generic errors that do not reveal whether the exam, code or assignment was wrong.
- Create/reuse attempts atomically and set start/deadline timestamps using server time.
- Return only the student-safe exam payload. Never send answer keys or marking keys to students.
- Enforce deadlines on every save/submit server-side; browser countdowns are display only.
- Firestore rules must deny student writes to exam status, hashes, answer keys, marks, release controls and other students' attempts/results.
- Record minimal audit events without logging submitted codes or hashes. Test rules in the Firebase Emulator Suite before production.

## Free-plan constraints
- Avoid one realtime listener per question. Use bounded reads, batched writes, paginated history and local countdowns with server checks on writes.
- Core deadline enforcement must not depend on scheduled functions. Add optional cleanup only after verifying project plan and function availability.
- Prefer bounded CSV and client-generated PDFs initially; add genuine XLSX/ZIP after verifying bundle/runtime cost.
- No AI grading, webcam proctoring, tab-locking or paid external services in v1.

## Results, reports and notifications
- Separate staff reporting access from student-facing result release.
- Use per-recipient notification documents (or equivalent recipient filters) and rules preventing cross-user reads.
- Student result visibility requires explicit release state. Staff reporting access must be independently authorised.
- PDFs use JDI header and only configured contact details/logo/watermark; do not invent institutional details.

## Release checklist
- Confirm the actual existing portal routes, school/class/student schemas and API deployment path before wiring these types into production flows.
- Test unauthorised users, wrong/expired codes, inactive tests, cross-school attempts, replay, concurrent requests, time expiry, unpublished results and notification isolation.
- Build/lint and emulator tests must actually pass before describing the feature as complete.
