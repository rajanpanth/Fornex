# Deploy the Fornex agent to Fly.io

5-minute path. Runs the brain loop on Fly's always-on Machines so your
laptop can sleep, restart, or fall off Wi-Fi without breaking the demo.

## What this deploys

A single Fly Machine that runs `node pm2-runner.js` (which is `agent/src/index.ts`
under ts-node). 256 MB RAM, one shared CPU, no public ports — pure outbound
worker. It hits Solana RPC, Azure OpenAI, and Pyth.

## Cost

Fly removed the perma-free tier in 2024. A shared-cpu-1x / 256 MB Machine
running 24/7 is ~$2/month. New accounts get a small trial credit and may
require a card on file.

## One-time setup

### 1. Install the Fly CLI

```cmd
:: Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

Re-open your terminal so `fly` is on PATH.

### 2. Sign in

```cmd
fly auth signup
```

If you already have an account: `fly auth login`. Browser opens, you
authenticate, terminal picks it up.

### 3. Pick a unique app name

`fly.toml` defaults to `fornex-agent`. App names are global on Fly, so
the first person to deploy claims that name. If yours is already taken,
edit `agent/fly.toml`:

```
app = "fornex-agent-<your-handle>"
```

## Deploy

From the repo root:

```cmd
fly launch --no-deploy --copy-config --name <your-app-name> --region iad
```

`--no-deploy` lets you set secrets before the first boot.
`--copy-config` re-uses our `agent/fly.toml` instead of regenerating it.

If `fly launch` complains it can't find the config, run from the agent
directory instead:

```cmd
cd agent
fly launch --no-deploy --copy-config --name <your-app-name> --region iad
```

## Set secrets

Every value the agent normally reads from `agent/.env` must be set as a
Fly secret. Run each one:

```cmd
fly secrets set ^
  AGENT_KEYPAIR="..."  ^
  FORNEX_TREASURY_KEYPAIR="..."  ^
  SOLANA_RPC_URL="https://your-helius-or-devnet-url"  ^
  SIGNALS_RPC_URL="https://api.mainnet-beta.solana.com"  ^
  VAULT_PROGRAM_ID="H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf"  ^
  VAULT_ADDRESS="HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR"  ^
  AZURE_OPENAI_ENDPOINT="https://your-azure-endpoint.openai.azure.com"  ^
  AZURE_OPENAI_KEY="..."  ^
  AZURE_OPENAI_DEPLOYMENT="gpt-4o"
```

Optional but recommended:

```cmd
fly secrets set ^
  FORNEX_TREASURY_SOURCE="treasury"  ^
  DRIFT_SKIP_EXECUTION="1"  ^
  FORNEX_EXECUTOR="synthetic"
```

Verify they're all set (values are hidden, only names show):

```cmd
fly secrets list
```

## First deploy

```cmd
fly deploy
```

Fly builds the Docker image, pushes it, and boots the Machine. Build
takes 60–90 seconds the first time, ~10 seconds after that.

## Confirm the loop is running

```cmd
fly logs
```

You should see, within a minute:

```
[synthetic] executor ready (on-chain Pyth-marked positions)
[sync] NAV checked: 5.000... SOL stored, 5.000... SOL spendable
... boxed cycle banner with BULL/BEAR/ZEN votes and a tx signature ...
```

Press Ctrl+C to detach. The agent keeps running.

Tail the next 15-minute cycle:

```cmd
fly logs --since 16m
```

## Day-to-day commands

| Goal | Command |
|---|---|
| Live tail logs | `fly logs` |
| Open Machine status | `fly status` |
| Restart the agent | `fly machine restart` |
| Stop the agent (no charges) | `fly machine stop` |
| Resume after stop | `fly machine start` |
| Update env secret | `fly secrets set KEY=value` (auto-redeploys) |
| Redeploy after code change | `fly deploy` |
| Tear it down completely | `fly apps destroy <app-name>` |

## When you push code locally

Fly does NOT auto-deploy on git push (that's Railway). After you commit
and push, run `fly deploy` from `agent/` to ship the new code.

If you want auto-deploy, add a tiny GitHub Action that runs `fly deploy`
on push to `main`. Outside the scope of this guide; ask me when you want it.

## Troubleshooting

**"Build failed: package-lock.json not found"**
Run `npm install` inside `agent/` once locally to generate the lock file,
then redeploy.

**"AGENT_KEYPAIR is required for agent execution"**
You forgot a secret. Run `fly secrets list` and re-check against the
list above.

**Logs show nothing for >2 minutes after deploy**
Machine probably crashed and Fly is restarting it. `fly status` shows
restart count. `fly logs --no-tail` dumps the most recent crash output.

**"App name not unique"**
Edit `app = "..."` in `agent/fly.toml` to something else and rerun
`fly launch`.

**Agent runs but no decisions land on `/proof`**
Check `fly logs` for `[logger] log decision: ...`. If those lines exist,
the issue is RPC or the dashboard polling — not the agent. If they don't,
the agent is hitting an env or RPC error before `logDecisionOnChain`.
