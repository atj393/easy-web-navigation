# Contributing to Easy Web Navigation

Thanks for your interest in contributing! Easy Web Navigation is a read-only keyboard accessibility
companion browser extension. Contributions that make it more useful, more accurate, and more honest
are very welcome.

Please also read the [Code of Conduct](CODE_OF_CONDUCT.md) and the [Security Policy](SECURITY.md).

## Project scope

Easy Web Navigation **inspects** keyboard accessibility (focus, tab order, navigation structure,
accessible names) at runtime. It is **not** an accessibility overlay, **not** an automatic fixer,
and **not** a legal-compliance certifier. Keeping that scope honest is a core project value.

## What contributions are useful

- New or improved **scanner rules** (deterministic, DOM-observable, well-tested).
- **Test coverage** (unit tests, edge cases, demo-page fixtures).
- New or improved **demo pages**.
- **Documentation** improvements and clearer accessibility wording.
- **Browser-compatibility** fixes (Chromium / Firefox).
- **Performance** improvements that keep behavior read-only.

## What is not accepted in the current phase (without prior discussion)

Open an issue to discuss before building any of these:

- AI features.
- Speech / audio features.
- Auto-fix or any mutation of inspected page DOM.
- Broad host-permission changes (e.g. `<all_urls>`).
- Legal-compliance claims or "certified/compliant" wording.
- Tracking, analytics, or telemetry.
- Remote API calls or uploading page content.

## Local setup

Requires Node `>=20` and `pnpm` 9.

```bash
pnpm install
pnpm dev            # Chromium dev build (WXT)
pnpm dev:firefox    # Firefox dev build
pnpm -C apps/demo-sites preview   # serve the demo pages
```

## Branch naming

Use short, descriptive, hyphenated branches with a type prefix:

- `feat/tab-path-legend`
- `fix/firefox-overlay-cleanup`
- `docs/contributing-tweaks`
- `test/scanner-shadow-dom`

## Commit message style

Use [Conventional Commits](https://www.conventionalcommits.org/): `type: short summary`
(`feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`). Keep commits focused. Do **not** add
`Co-Authored-By` or generated-by trailers.

## Development workflow

1. Open (or comment on) an issue describing the change.
2. Branch from `main`.
3. Make a focused change with tests.
4. Run the full check suite locally (below).
5. Open a pull request using the PR template.

## Testing requirements

All of these must pass before a PR is merged:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm build:firefox
```

(`pnpm run ci` runs typecheck → lint → test → build.) Add or update Vitest tests for any rule,
scanner, overlay, or report change. Prefer deterministic tests; mock `getBoundingClientRect` where
jsdom lacks layout.

## Accessibility review expectations

- New rules must be **deterministic** and based only on what is observable in the DOM.
- Provide **failing and passing HTML examples** and note **false-positive risks**.
- Never overclaim: a passing check is not proof of accessibility or compliance.
- Keep the extension **read-only** — no changes to inspected page nodes, focus, or tab order.

## Documentation expectations

Update relevant docs when behavior changes: `README.md`, `docs/architecture.md`,
`docs/limitations.md`, `docs/roadmap.md`, and `CHANGELOG.md` (under `[Unreleased]`).

## Pull request checklist

The PR template includes the full checklist. At minimum: the change is focused, tests pass, the
build passes, no broad permissions are added, no AI/speech/auto-fix is introduced without prior
approval, no compliance claim is added, and docs are updated.

## Reporting security issues

Do **not** open public issues for exploitable vulnerabilities — follow [SECURITY.md](SECURITY.md).
