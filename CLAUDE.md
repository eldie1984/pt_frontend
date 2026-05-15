# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (localhost:3000)
pnpm build        # Production build (standalone output)
pnpm lint         # ESLint
pnpm test:e2e     # Playwright E2E tests (requires dev server running or starts one automatically)
```

Run a single Playwright test file:
```bash
npx playwright test e2e/your-test.spec.ts
```

## Architecture

This is a **Next.js 16 App Router** single-page trading terminal. The app is essentially one page (`app/page.tsx`) that renders different "screens" based on state — there is no file-based routing beyond the root.

### Screen Navigation

`app/page.tsx` wraps everything in `<AuthProvider>` and renders one of four screens based on `activeScreen` state:
- `portfolio` → `PortfolioScreen`
- `terminal` → `TerminalScreen`
- `instruments` → `InstrumentsScreen`
- `preferences` → `PreferencesScreen`

A `<TickerBar>` and `<TopNav>` are always rendered above the active screen when authenticated. Unauthenticated users see only `<LoginScreen>`.

### Authentication

`hooks/use-auth.tsx` provides `AuthProvider` + `useAuth()` context. On mount it reads `auth_token` from `localStorage` and validates it against the backend. `lib/auth.ts` contains the `AuthAPI` class making raw `fetch` calls to `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001`).

### Backend API

All API calls go to `NEXT_PUBLIC_API_URL` (backend at port 3001 by default). API functions live in `lib/api/instruments.ts` and accept a JWT `token` string as a parameter — callers must get the token from `useAuth()`.

### Component Organization

```
components/
  screens/       # Full-page screen components (portfolio, terminal, instruments, preferences, login)
  portfolio/     # Sub-components used only by PortfolioScreen
  terminal/      # Sub-components used only by TerminalScreen
  ui/            # shadcn/ui primitives (do not modify — regenerate via shadcn CLI)
  top-nav.tsx    # Global navigation
  ticker-bar.tsx # Real-time ticker strip
```

### Styling

- **Tailwind CSS v4** with CSS variables for theming
- **shadcn/ui** (New York style, neutral base) — add new components with `npx shadcn@latest add <component>`
- Theme CSS variables defined in `app/globals.css`; dark mode is the default (`<html class="dark">`)
- Three font variables: `--font-dm-sans` (body), `--font-space-mono` (monospace/code), `--font-rajdhani` (display)

### Key Constraints

- `typescript.ignoreBuildErrors: true` is set in `next.config.mjs` — TypeScript errors won't break the build, but fix them anyway.
- No unit test framework is set up; only Playwright E2E tests exist under `e2e/`.
- E2E tests run with a single worker (`workers: 1`) — keep tests sequential-safe.
