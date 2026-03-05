# Contributing Guide

> [日本語版](CONTRIBUTING.md)

Thank you for your interest in contributing to StreamTagInventory! This document explains the workflow from setting up your development environment to getting your PR merged.

## Development Environment Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.3 or later

### Installation & Startup

```bash
# Fork the repository and clone it
git clone https://github.com/<your-username>/StreamTagInventory.git
cd StreamTagInventory

# Install dependencies
bun install

# Start the development server (backend + bundle + tailwind + test + type + lint in parallel)
bun run start
```

## Development Workflow

1. Fork the repository
2. Create a branch (see naming convention below)
3. Commit your changes
4. Push to your fork
5. Open a Pull Request

### Branch Naming Convention

Use the `type/description` format.

| type       | Purpose            |
| ---------- | ------------------ |
| `feat`     | New feature        |
| `fix`      | Bug fix            |
| `docs`     | Documentation      |
| `refactor` | Refactoring        |
| `test`     | Add/update tests   |
| `chore`    | Miscellaneous      |

Examples: `feat/add-tag-filter`, `fix/template-save-error`

## Coding Standards

- **Lint / Format**: [Biome](https://biomejs.dev/) (configured in `biome.jsonc`)
  - Run `bun run check` to auto-fix lint and format issues
- **TypeScript**: strict mode enabled
- **Path aliases**: `~/*` → `./src/*` (defined in `tsconfig.json`)
- **Theme colors**: Use CSS variables from `src/index.css` via Tailwind classes (`bg-surface`, `text-primary`, `border-border`, etc.)

## Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/) are recommended (not required).

```
type: short summary of the change

# Examples
feat: add tag filter feature
fix: resolve template save error
docs: add CONTRIBUTING.md
```

Common types:

| type       | Purpose            |
| ---------- | ------------------ |
| `feat`     | New feature        |
| `fix`      | Bug fix            |
| `docs`     | Documentation      |
| `refactor` | Refactoring        |
| `test`     | Add/update tests   |
| `chore`    | Miscellaneous      |
| `ci`       | CI configuration   |

## Testing

Before opening a PR, make sure all 4 commands pass:

```bash
bun run type    # TypeScript type check
bun run check   # Biome lint + format
bun run test    # Unit tests
bun run e2e     # Playwright e2e tests
```

- Unit tests: `src/**/*.test.ts(x)` — Happy DOM + Testing Library
- E2E tests: `e2e/*.spec.ts` — Playwright (Chromium)

## Pull Requests

- **Title**: Conventional Commits format recommended (e.g., `feat: add tag filter feature`)
- **CI**: Ensure all checks pass (type → lint → test → build → e2e)
- **VRT**: If Visual Regression Testing shows diffs, verify they are intentional
- **Merge strategy**: PRs are squash-merged

## i18n (Internationalization)

- Do not hardcode UI text — use i18next translation keys
- When adding new keys, update both `src/i18n/locales/en.json` and `src/i18n/locales/ja.json`
