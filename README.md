# Jaystarbliss Studios | Dynamic Hub

A premium, full-stack educational and portfolio platform designed for Jaystarbliss Studios. This platform serves as a modern digital headquarters, featuring dynamic content management, real-time administrative dashboards, role-based portals (Student, Parent, Tutor, School), and a robust React SPA front-end.

## Features

- **Public Hub:** Home, Programs, Services, Portfolio, Resources, FAQ, Blog.
- **Portals (RBAC Enforced):** Dedicated environments for Students, Parents, Tutors/Staff, and Schools.
- **Administrative CMS (Admin):** 
  - Manage users, roles, programs, services, and blog content.
  - Interactive charts via Recharts for quick data insights.
  - CSV Data exports for Inquiries and User Registrations.
- **Content Management:** Fully integrated Firebase Firestore backend for rapid UI hydration.
- **Interactive Visuals:** Framer Motion-powered route transitions, page animations, and an aesthetic red-black-white color palette.

## Technical Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS.
- **Animations:** Framer Motion.
- **Routing:** React Router v7.
- **Backend/DB:** Firebase Firestore & Firebase Auth.
- **Data Visualization:** Recharts (Analytics Dashboard).
- **Icons:** Lucide React.

## Getting Started

1. Set up a Firebase project and enable Firestore & Authentication.
2. Ensure Firebase environment settings are loaded (via config files).
3. Install dependencies: `npm install`
4. Run locally: `npm run dev`
5. Build for production: `npm run build`

## Permissions

The app defines specific roles: `USER` (default), `STUDENT`, `PARENT`, `TUTOR`, `SCHOOL`, `CONTENT_ADMIN`, `SERVICES_ADMIN`, and `SUPER_ADMIN`.
Use the Admin Dashboard to modify user roles and gain complete access to portal routes and administrative capabilities.
