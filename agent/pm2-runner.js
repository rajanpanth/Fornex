#!/usr/bin/env node
// pm2-runner.js
// ----------------
// Tiny launcher PM2 can hand to node.exe directly, instead of trying to
// resolve `npx ts-node ...` on Windows (which fails because PM2 splits the
// shell command on whitespace into a script path + args).
//
// We require ts-node's CJS register hook and then require the agent entry
// point. The runtime is identical to `npx ts-node agent/src/index.ts`.

require("ts-node/register/transpile-only");
require("./src/index.ts");
