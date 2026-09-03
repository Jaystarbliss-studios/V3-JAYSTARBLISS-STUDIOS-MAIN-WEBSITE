# Jaystarbliss Studios | Dynamic Hub

The Jaystarbliss Studios web platform combines the public studio website, education services, role-based portals, school operations, CMS, payments and administrative controls.

## Current platform
- Public Hub: Home, Programs, Services, Portfolio, Resources, FAQ, Blog, contact and project requests.
- Portals: Student, Parent, Staff/Tutor and School workspaces with role-aware navigation.
- School operations: school-scoped learners, resources, links, exams, passcodes and staff-school assignments.
- Learning operations: resources, calendars, live classes, curriculum and learner progress.
- Payments: authenticated Paystack initialization plus server-side verification, webhook reconciliation and enrollment-linked payment context.
- Admin CMS: editable pages/sections, Programs, Services, Portfolio, Kids Zone, News/Blog, Resources, Users & Roles, Approvals, Staff operations and settings.
- Lead CRM: searchable inquiry pipeline, stage management, ownership, follow-ups, notes and activity logging.
- Security: Firebase Auth state checks, trusted privileged provisioning, account lifecycle enforcement and school-level access isolation.

## Stack
React 19 · TypeScript · Vite · Tailwind CSS · React Router · Firebase Auth/Firestore · Netlify Functions · Paystack · Cloudinary · Motion · Recharts · Lucide React.

## Roles
`USER`, `STUDENT`, `PARENT`, `STAFF`/`TUTOR`, `SCHOOL`, `CONTENT_ADMIN`, `EDUCATION_ADMIN`, `SERVICES_ADMIN`, `SUPER_ADMIN`.

Privileged roles are provisioned through trusted server-side workflows. A selected portal tab is never an authorization source.

## Development
`npm ci` → `npm run dev` → `npm run lint` → `npm run build`

The GitHub Quality Gate runs lint and production builds for pushes and pull requests targeting `main`.

## Operational docs
See `SECURITY_MODEL.md` and `docs/PAYSTACK-OPERATIONS.md` for authorization, trusted workflows and payment operations.
