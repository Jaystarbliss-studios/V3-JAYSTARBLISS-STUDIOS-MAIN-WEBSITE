---
name: ui-ux-pro-max
description: "UI/UX design intelligence for web, mobile, and desktop. Use when designing, building, reviewing, or fixing interfaces, including pages, components, design systems, accessibility, interaction, responsive layout, typography, color, charts, and stack-specific UI implementation."
---

# UI/UX Pro Max - Design Intelligence

This repository adopts the upstream UI/UX Pro Max methodology from:
https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

The upstream repository is the reference implementation for the searchable design intelligence, while this project adds Jaystarbliss-specific visual and product rules below.

## Current application stack

**React 19 + TypeScript + Vite + Tailwind CSS + React Router + Motion + Recharts + Lucide + Firebase**.

## When to Apply

Use this Skill when a task involves UI structure, visual design decisions, interaction patterns, accessibility, responsive behavior, typography, color, charts, animation, navigation, or perceived quality.

Skip it for pure backend logic, database/API design, infrastructure, or non-visual scripts unless the change affects the interface or interaction model.

## Rule Categories by Priority

Follow priority 1→10:

1. **Accessibility** — contrast, alt text, keyboard navigation, accessible names, focus states, reduced motion, non-color-only meaning.
2. **Touch & Interaction** — comfortable targets, adequate spacing, clear pressed/loading/error feedback, no hover-only critical actions.
3. **Performance** — responsive images, lazy loading, route splitting, reserved layout space, efficient rendering.
4. **Style Selection & Consistency** — match product type, use one visual language, consistent icon family, semantic tokens.
5. **Responsive Layout** — mobile-first, stable breakpoints, no horizontal overflow, readable line lengths, safe-area awareness.
6. **Typography & Color** — readable sizing, hierarchy, semantic tokens, accessible foreground/background pairs.
7. **Animation** — meaningful, interruptible, spatially coherent motion that respects reduced-motion preferences.
8. **Forms & Feedback** — visible labels, inline errors, loading/success/error states, useful empty states, progressive disclosure.
9. **Navigation** — predictable hierarchy, active states, back behavior and deep links.
10. **Data Visualization** — readable legends/tooltips and accessible interpretation without depending on color alone.

## Upstream Workflow

For major visual work, use the upstream design-system/search methodology when its repository data is available:

- Detect the actual stack before applying stack guidance.
- Use a coherent `--design-system` pass for a new product/page family.
- Use targeted domain searches for specific UX concerns.
- Use stack searches for React/Tailwind implementation details after the semantic UX outcome is known.
- Retry a search once when the result is empty or off-topic; never fabricate a database result.
- Persist a master system plus page-specific overrides for long-running projects.

The upstream project contains the full searchable datasets for styles, palettes, typography, icons, charts, motion, UX rules and stack guidance.

## Jaystarbliss Studios Project Rules

### Product character

Jaystarbliss Studios is an education + creative services platform. The interface should feel:

- Premium
- Modern
- Trustworthy
- Educational
- Technology-forward
- Operationally clear

Prefer restrained glass/elevation, calm surfaces, strong editorial hierarchy and subtle motion over decorative noise.

### Brand tokens

- Brand Slate: `#1E293B`
- Brand Red: `#B91C1C`
- Brand Neutral: `#F8FAFC`
- Supporting focus/interaction accent: Azure/Cyan where existing components already use it.

Use semantic tokens rather than introducing new raw colors per component.

### Typography

Keep Poppins as the primary family unless a deliberate brand change is approved. Use a readable base size, approximately 16px on mobile, body line-height around 1.5–1.7, and 600–800 heading weights. Use tabular figures for aligned numeric dashboard data.

### Iconography

Use the existing Lucide icon system consistently. Never use emoji as interface icons. Decorative icons next to equivalent visible labels should be hidden from assistive technology; standalone controls need accessible names.

### Layout & spacing

Use a 4/8px spacing rhythm with common steps such as 8, 12, 16, 20, 24, 32, 40, 48 and 64px. Prefer 16–24px surface radii and consistent elevation. Keep dashboard content within predictable desktop max widths and collapse cleanly to one column on small screens.

### Dashboards

Dashboard hierarchy:

1. Context header + primary action
2. High-value KPI summary
3. Primary operational/analytic surface
4. Secondary insight panels
5. Recent activity + next actions

Use four or fewer top-level KPIs at desktop widths where possible. Every KPI should communicate the metric, current value and the useful destination/action. Synthetic metrics and fabricated fallbacks are prohibited.

For education dashboards, prefer the upstream **Accessible & Ethical / Minimalism & Swiss / Trust & Authority / Education Dashboard** reasoning pattern: credibility, progress visibility, credentials, clear next actions and restrained decoration.

### Interaction

Primary touch targets should be at least 44×44px on web/mobile touch surfaces, with sensible spacing between controls. Provide visible focus, pressed/loading/disabled states, and never require hover for critical actions.

### Responsive behavior

Mobile-first around approximately 375 / 768 / 1024 / 1440px. Never disable browser zoom. Avoid horizontal page scrolling. Prefer `min-height: 100dvh` for viewport shells and reserve space around fixed navigation.

### Motion

Use transform/opacity where possible. Keep transitions short and meaningful, make them interruptible, avoid blocking input, and respect `prefers-reduced-motion`.

### Forms & feedback

Use visible labels, helper text for complex fields, field-local errors, submit loading/success/error states, useful empty states and confirmation for destructive actions.

## Existing System Rule

Do not introduce a competing visual framework. Reuse and improve the existing project primitives and classes:

- `pro-surface`
- `pro-interactive`
- `digital-canvas`
- `glass-card`
- `glass-card-subtle`
- `dashboard-interface`
- existing `brand-*` utilities
- `src/components/ui/*`

Before a major page redesign, inspect the existing component and the project design system under `design-system/jaystarbliss-studios/`. Page-specific overrides win over the master system.

## Pre-Delivery Checklist

- No horizontal scrolling on mobile.
- Visible keyboard focus on interactive controls.
- Touch targets are comfortable and sufficiently separated.
- Icon-only controls have accessible names.
- Decorative icons are hidden from assistive technology.
- Status is not communicated by color alone.
- Forms have visible labels and local error feedback.
- Light/dark contrast is verified independently.
- Reduced-motion behavior is respected.
- Async content reserves enough space to reduce layout shift.
- Charts and important metrics remain understandable without color alone.
- Fixed headers/drawers/bottom navigation do not obscure focused or scrollable content.
- Important data is authoritative; never invent values to make a dashboard look populated.

## Source of Truth

The upstream UI/UX Pro Max repository remains the reference for searchable UI/UX intelligence. This file adds only the project-specific interpretation needed for Jaystarbliss Studios.
