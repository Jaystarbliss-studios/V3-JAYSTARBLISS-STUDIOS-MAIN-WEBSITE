# Production Security & Operations Model

This repository uses Firebase Authentication + Cloud Firestore + Cloud Storage with role-aware portal routing.

## Authorization model

Portal access is determined by Firebase Authentication plus the user's authoritative role/profile records. Browser storage is never treated as an authorization source.

Roles currently supported:

- SUPER_ADMIN
- ADMIN
- CONTENT_ADMIN
- EDUCATION_ADMIN
- SERVICES_ADMIN
- MARKETING_ADMIN
- SUPPORT_ADMIN
- STAFF
- TUTOR
- INSTRUCTOR
- STUDENT
- PARENT
- SCHOOL

Administrative roles are mirrored into the `admins/{uid}` registry when changed from the Admin Users screen. This avoids making the `users/{uid}` document itself the security authority for administrative access.

## Account lifecycle

Users now have an `accountStatus` value:

- `ACTIVE`
- `SUSPENDED`
- `BANNED`

The protected portal route fails closed when the authenticated user's account is suspended or banned.

The primary super administrator cannot be suspended or banned from the Admin Users UI.

## Firestore ownership boundaries

Sensitive collections are no longer publicly readable/writable:

- users
- individualStudents
- students
- parents
- payments
- enrollment_requests
- student_requests
- notifications
- activityLogs
- personalResources
- personalLinks
- schoolResources
- schoolLinks
- schoolExams
- schoolPasscodes

Public CMS collections remain readable by the public, while mutations require an administrator.

## Query rule

Firestore security rules are not filters. Client queries must include the same ownership/scoping constraints required by the rules.

The portal dashboards were updated accordingly:

- Parent dashboard queries children/payments/enrollments by parent ownership.
- Student dashboard queries personal resources/modules/notifications by student identity.
- School dashboard queries school resources, exams, links, passcodes and roster by school ID.
- Broad client-side collection scans were removed from these portal paths.

## Synthetic data policy

Production dashboards must not invent activity, performance scores, enrollment counts, school counts, attendance, or progress.

Empty datasets now render as empty/zero states instead of fabricated operational telemetry.

## Firebase deployment

The repository now contains:

- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `storage.rules`

The application currently connects to the named Firestore database:

`ai-studio-jaystarblissdyna-085e16ac-52ee-43ae-9c0c-52f6db7f8f7c`

Deploy the rules from a trusted local environment after reviewing the rule changes. Do not paste Firebase service-account credentials or private keys into source control or chat.

## Payments

Paystack initialization and verification are performed server-side. Paystack requires secret-key API calls to stay on the backend, and transaction verification checks status, currency, reference and amount before a payment is marked VERIFIED. citeturn3search6turn3search8

The Vercel API layer uses Firebase Admin for trusted writes; the Admin SDK is intended for controlled server/serverless environments and must not be exposed to the browser. citeturn4search0

## Remaining production verification

The GitHub integration available to this coding session cannot directly inspect the live Firebase project's data, deployed rules, indexes, Authentication users, or Vercel environment variables.

Before production launch, verify:

1. The rules in `firestore.rules` are deployed to the named database above.
2. Required Firestore composite indexes exist for the scoped queries.
3. Admin users who should have elevated roles have corresponding `admins/{uid}` documents.
4. Vercel/hosting environment variables and Firebase configuration match the production project.
5. Storage write policy is reviewed against the actual upload paths used by the application.
6. End-to-end tests are run against a staging Firebase project or emulator before changing production data.

## CI

`.github/workflows/quality.yml` runs the repository lint and production build on pushes and pull requests. The CI job uses Bun and installs the dependency graph from package.json so server-side dependencies introduced for the payment API are available.
