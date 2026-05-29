#!/usr/bin/env node
/**
 * Pre-build guard: fails the build if a Helius API key (or any other
 * server-only secret) would leak into the client bundle via NEXT_PUBLIC_*.
 *
 * The proxy at /api/rpc routes browser traffic through the server using
 * HELIUS_RPC_URL (no NEXT_PUBLIC_ prefix). If anyone re-introduces
 * NEXT_PUBLIC_HELIUS_* anywhere under pages/, components/, hooks/, or lib/
 * the build fails loudly.
 */
const fs = require("fs");
const path = require("path");

const SCAN_DIRS = ["pages", "components", "hooks", "lib"];
const FORBIDDEN = [
  /process\.env\.NEXT_PUBLIC_HELIUS_API_KEY/,
  /process\.env\.NEXT_PUBLIC_HELIUS_KEY/,
  /process\.env\.HELIUS_API_KEY/, // server-only, must not be referenced from frontend code
];

const EXTS = [".ts", ".tsx", ".js", ".jsx"];

let violations = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (EXTS.includes(path.extname(entry.name))) {
      const content = fs.readFileSync(p, "utf8");
      for (const pat of FORBIDDEN) {
        if (pat.test(content)) {
          console.error(
            `[check-no-secrets] forbidden pattern ${pat} found in ${p}`
          );
          violations += 1;
        }
      }
    }
  }
}

for (const d of SCAN_DIRS) walk(path.join(process.cwd(), d));

if (violations > 0) {
  console.error(
    `[check-no-secrets] ${violations} violation(s) found. Build aborted.`
  );
  process.exit(1);
}

console.log("[check-no-secrets] OK — no client-side secret references detected");
