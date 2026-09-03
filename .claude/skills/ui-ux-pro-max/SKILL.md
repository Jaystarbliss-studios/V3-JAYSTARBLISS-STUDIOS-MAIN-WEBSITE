---
name: ui-ux-pro-max
description: "UI/UX design intelligence for Jaystarbliss Studios. Use when designing, building, reviewing, or fixing web UI, dashboards, accessibility, responsive behavior, typography, colors, charts, interactions, and animation."
---

# UI/UX Pro Max — Jaystarbliss Studios

This repository adopts the UI/UX Pro Max methodology from the public project:
https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

Current application stack: **React 19 + TypeScript + Vite + Tailwind CSS**.

## Priority order

1. Accessibility — WCAG-aware contrast, visible focus, labels, keyboard navigation, meaningful alt text, non-color-only status, reduced motion.
2. Touch & interaction — comfortable targets, adequate spacing, clear pressed/loading/error feedback, never hover-only behavior.
3. Performance — lazy-load heavy/below-fold UI, prevent layout shift, responsive images, transform/opacity animation.
4. Style consistency — one visual language, one icon family, consistent elevation/radius, semantic color tokens, intentional dark mode.
5. Responsive layout — mobile-first, no horizontal overflow, stable breakpoints, readable line lengths.
6. Typography & color — readable base sizes, strong hierarchy, semantic tokens, accessible foreground/background pairs.
7. Motion — meaningful, interruptible transitions; respect `prefers-reduced-motion`.
8. Forms & feedback — visible labels, inline errors, loading/success/error states, progressive disclosure, useful empty states.
9. Navigation — predictable hierarchy and stable active/back behavior.
10. Data visualization — accessible labels/legends/tooltips; never rely on color alone.

## Jaystarbliss visual direction

Premium, modern, trustworthy, educational, technology-forward. Use calm surfaces, strong hierarchy, restrained glass/elevation, and subtle motion rather than visual noise.

Brand tokens:
- Brand Slate: `#1E293B`
- Brand Red: `#B91C1C`
- Brand Neutral: `#F8FAFC`

Supporting azure/cyan accents may be used sparingly for focus, interactive emphasis, and depth because the existing application already uses them.

Use Lucide SVG icons consistently; never use emoji as interface icons.

## Existing-system rule

Do not introduce a competing system. Reuse and improve existing classes/tokens such as `pro-surface`, `pro-interactive`, `digital-canvas`, `glass-card`, `glass-card-subtle`, and `brand-*` utilities.

## Page workflow

Before major UI work, inspect the current component and read `design-system/jaystarbliss-studios/MASTER.md`. If a page override exists under `design-system/jaystarbliss-studios/pages/`, that override wins. Address accessibility and responsive behavior before decorative polish. Prefer shared components/classes over one-off styling.

## Pre-delivery checklist

- No horizontal scrolling on mobile.
- Visible keyboard focus on interactive controls.
- Comfortable touch targets and clear press/loading states.
- Readable light/dark contrast.
- Status communicated with text/icon as well as color.
- Animations respect reduced motion and do not block input.
- Charts remain understandable without color alone.
- Async UI reserves space to minimize layout shift.
- Icon-only controls have accessible names; decorative icons are hidden from assistive technology.
