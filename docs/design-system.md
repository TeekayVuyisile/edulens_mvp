# Edulens design system

The rules every screen follows. Tokens live in `frontend/src/styles/theme.scss`
(Bootstrap Sass variables plus `--el-*` CSS custom properties). Custom components
are styled in `frontend/src/styles/components.css`.

## Principles

- **Calm, readable, trustworthy.** The users are teachers and school leaders working
  through a busy day. Clarity beats decoration.
- **Warm, not childish.** It is a Foundation Phase product, but adults use it. The
  sunflower accent and rounded shapes bring warmth; the type and layout stay professional.
- **Plain language.** "Sign in", "Learners", "Mark as repeating". No jargon or raw codes.
- **Accessible by default.** WCAG 2.1 AA contrast, visible focus, 44px touch targets,
  labelled inputs, and motion that respects the OS setting.

## Colour

| Role | Token | Value | Use |
|---|---|---|---|
| Primary | `$primary` / `--el-primary` | `#4F46E5` indigo 600 | Main actions, active nav, links |
| Primary hover | `--el-primary-hover` | `#4338CA` | Hover/pressed |
| Primary soft | `--el-primary-soft` | `#EEF2FF` | Selected rows, active nav background, info alerts |
| Accent | `--el-accent` | `#FBBF24` sunflower | Highlights, avatars, brand spark. **Decorative only: never text on white.** |
| Success | `$success` | `#15803D` | Passed, saved, active. White text passes AA (5.0:1) |
| Danger | `$danger` | `#DC2626` | Destructive actions, errors |
| Warning | `$warning` | `#F59E0B` | Needs attention. Always with dark text |
| Info | `$info` | `#0369A1` | Neutral notices |
| Text | `--el-text` | `#0F172A` slate 900 | Body and headings |
| Muted text | `--el-text-muted` | `#475569` slate 600 | Secondary text (minimum for text on white) |
| Subtle text | `--el-text-subtle` | `#64748B` slate 500 | Section labels and captions only, ≥ 12px bold |
| Canvas | `--el-canvas` | `#F8FAFC` | Page background |
| Surface | `--el-surface` | `#FFFFFF` | Cards, sidebar, modals |
| Border | `--el-border` | `#E2E8F0` | Dividers, card borders |

Status is never shown by colour alone: pair it with an icon or a word ("Active", "Repeating").

## Typography

- **Plus Jakarta Sans Variable**, self-hosted via `@fontsource-variable/plus-jakarta-sans`.
- Base 16px, line height 1.6. Headings 700–800 with slight negative tracking.
- Scale: 12 / 14 / 16 / 18 / 20 / 24 / 30px (`$h1`–`$h6`).
- Numbers in tables and stat cards use tabular figures (`.tabular-nums`, automatic in `.table`).

## Shape, depth and spacing

- Radius: 6px small controls, 8px inputs/buttons, 12px cards, 16px modals, pill badges.
- Shadows are subtle (`--el-shadow-sm`, `--el-shadow`, `--el-shadow-lg`). Cards use a border, not a heavy shadow.
- Spacing follows Bootstrap's 4px-based scale. Page padding: 16px mobile, 32px from 768px.
- Content max width 1440px. Breakpoints checked: 375, 768, 1024, 1440.
- z-index: sidebar 20, top bar 30. Bootstrap owns 1000+ (dropdowns, modals, toasts).

## Layout

- **App shell** (`components/layout/AppShell.jsx`): 264px sidebar (76px collapsed; the
  preference is remembered per browser), sticky translucent top bar, animated page area.
  Below 992px the sidebar becomes an off-canvas drawer opened from the top bar.
- **Navigation** is defined per role in `config/navigation.js`.
- **Sign-in pages** use `components/auth/AuthLayout.jsx`: a brand panel (desktop) and a form column.

## Motion (framer-motion)

Presets in `frontend/src/lib/motion.js`. `<MotionConfig reducedMotion="user">` wraps the
app, so people who ask their OS for reduced motion get instant transitions.

- **Durations:** 150ms micro-interactions and exits, 220ms page/enter, 300ms larger reveals.
- **Easing:** ease-out (`[0.22, 1, 0.36, 1]`) to enter, ease-in to exit. Never linear.
- **Properties:** `transform` and `opacity` only. No animating width/height on hot paths
  (the inline alert reveal is the one deliberate exception).
- **Restraint:** at most one or two animated elements per view. Infinite animation is for
  loading indicators only.
- **Patterns:** route change = 8px fade-up (`pageTransition`); sidebar active item =
  shared-layout spring (`layoutId`); inline alerts = reveal; lists = `staggerContainer` +
  `fadeUpItem`, kept to the first ~8 items.
- Hover feedback uses colour, border or shadow, never scale that shifts layout.

## Components and patterns

- **Icons:** Lucide via `react-icons/lu`, 16–20px, `aria-hidden` when next to a label.
  Icon-only buttons need `aria-label`. (Older pages still use Bootstrap Icons until they're redesigned.)
- **Forms:** every input has a visible `<label>`, the right `autoComplete`/`inputMode`, and
  errors shown inline under the field (`PasswordField` shows the pattern). Submit buttons
  disable and show a spinner while saving.
- **Feedback:** inline `FormAlert` for errors that belong to a form; toasts for confirmations
  of background actions.
- **Destructive actions** always ask for confirmation in a modal, never `window.confirm`.
- **Loading:** `FullPageLoader` for route/session loads; skeletons or spinners inside cards.
  Never a blank screen.
- **Empty states** explain what goes here and offer the next action.
- **Interactive cards** opt in with `.card-interactive`; plain cards don't react to hover.

## Pre-delivery checklist

- [ ] Text contrast ≥ 4.5:1 (muted text no lighter than slate 600)
- [ ] Visible focus on every interactive element; tab order matches the visual order
- [ ] Touch targets ≥ 44×44px
- [ ] Inputs labelled; errors next to the field
- [ ] No emoji icons; icons from the Lucide set
- [ ] Works at 375 / 768 / 1024 / 1440px with no horizontal scroll
- [ ] Animations use the presets and respect reduced motion
