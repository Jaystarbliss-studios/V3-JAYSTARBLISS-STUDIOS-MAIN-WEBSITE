# Architecture Document

## Overview
This platform employs a Single Page Application (SPA) architecture utilizing React and Vite, backed by Firebase for authentication, database operations, and data persistence.

## System Components

1. **Routing Layer (`src/App.tsx`)**
   - Implements `react-router-dom` for structural routing.
   - Encompasses Public Layouts, Protected Admin Layouts, and isolated Portal Layouts.
   - Wraps routes with `AnimatePresence` and `framer-motion` configurations to animate mount/unmount phases.

2. **Security & Role-Based Access Control (RBAC)**
   - Managed via the `ProtectedRoute` wrapper component.
   - Determines authorization strictly through Firebase Authentication contexts and roles queried from the Firestore `users` collection.
   - Grants routing access to isolated portal sections (Student, Parent, Tutor, School) dynamically.

3. **Admin Content Management System (CMS)**
   - Located primarily within `/src/pages/admin`.
   - Admin routes map to Firestore collections (`programs`, `services`, `portfolio`, `blog`, `inquiries`, `users`).
   - Features robust visualization elements (Recharts) and native tabular data management with direct CSV export utilities.

4. **UI/UX Infrastructure**
   - **Theme Engine:** Context-based dark/light toggles (`ThemeContext`), persisting via `localStorage`.
   - **Styling:** Tailwind CSS mapped to design system variables defined in `tailwind.config.js` (Brand Colors: Slate, Red, Sand).
   - **Feedback Mechanisms:** Centralized Toast alerts (`ToastContext`) and route-level error trapping (`ErrorBoundary`).

5. **Persistence Layer**
   - **Firebase Firestore:** NoSQL hierarchical architecture.
   - **Collections Used:** `users`, `inquiries`, `programs`, `services`, `pages`, `blog`, `portfolio`.
   - Direct real-time reads and transactional updates via Firebase v9 Modular SDK.

## Scalability and Future-Proofing
- Extensible component structures support adding new Roles or Sub-Portals rapidly.
- Type definitions enforce strict schemas over Firestore documents ensuring robust runtime type safety.
