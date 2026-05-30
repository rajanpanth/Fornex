# Testing

This repo has two separate validation paths:

- the Next.js frontend and API routes
- the Anchor/Solana SBF program tests

Do not treat a clean frontend build as proof that the Anchor program test suite passed.

## Frontend Validation

Run these from the repository root:

```bash
npm run typecheck
npm run lint
npm run build
```

`npm run build` runs `scripts/check-no-secrets.js` first, then `next build`.

## TypeScript Validation

```bash
npm run typecheck
```

This runs `tsc --noEmit` across the Next pages, components, hooks, API routes,
agent TypeScript, SDK TypeScript, and tests included by `tsconfig.json`.

## Anchor Validation

Run Anchor tests from Linux or WSL2:

```bash
anchor --version
solana --version
npm test
```

`npm test` is intentionally still `anchor test`. It builds the Anchor program,
starts the local validator flow used by Anchor, and then runs the TypeScript
tests configured in `Anchor.toml`:

```toml
[scripts]
test = "npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

## Known Windows Limitation

On native Windows, `anchor test` can fail before the Fornex tests run while
compiling the Solana SBF target. The observed failure is:

```text
couldn't read ...\target\sbf-solana-solana\release\build\serde_core-...\out/private.rs
The filename, directory name, or volume label syntax is incorrect. (os error 123)
```

That error is in the Rust/Solana SBF build toolchain path handling, not in the
Next.js frontend build and not in the TypeScript test runner. Do not report
Anchor tests as green from native Windows if this error appears. Use WSL2 or a
Linux CI runner for the authoritative Anchor validation.

Recommended WSL2 flow:

```bash
git clone https://github.com/rajanpanth/Fornex ~/fornex
cd ~/fornex
npm ci
anchor test
```

Keep the clone under the Linux filesystem (`~/fornex`), not `/mnt/c/...`, to
avoid Windows path translation in Rust/SBF build outputs.
