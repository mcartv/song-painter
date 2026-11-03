# Song Painter — Hybrid GPU backend / browser fallback (v7)

## Architecture

- **Render Static Site**: hosts existing Vite frontend (`npm ci && npm run build`, publish `dist`).
- **Modal**: Python FastAPI endpoint on a T4 GPU, runs Demucs (`htdemucs`) and returns 50-fps vocal-level, MIDI pitch, and music-level timelines.
- **Fallback**: unchanged v6 browser Web Worker automatically starts if remote analysis fails or if the API URL is unset.
- **No database**. Uploaded audio is written to temporary files in the GPU container and deleted after the request. The HTTP upload still leaves the user's device; disclose this to users.

Important: The GPU endpoint is a synchronous beta prototype with no server-verified authentication, durable queue, rate limiting, or job cancellation. **Do not publicly enable `VITE_ANALYSIS_API_URL` for untrusted traffic** until you implement real authentication, quotas, and billing safeguards. CORS alone is not authorization. GPU calls can incur charges.

## 1. Install / verify

Run in repo root (PowerShell):

```powershell
node .\song-painter-hybrid-backend-v7\install-patch.cjs --check
node .\song-painter-hybrid-backend-v7\install-patch.cjs --install
npm run build
npm run test
```

If `npm run build` fails, stop. Do not deploy. **No installation will be performed if the --check step fails.**

## 2. Modal account, authentication and CORS

Create a Modal account and install its CLI on your development machine:

```powershell
py -m pip install -r backend/requirements.txt
modal setup
```

Create the required Modal secret. Replace the example domains with the exact website origin you own and your Vite local dev origin (no paths, no trailing slash):

```powershell
modal secret create song-painter-configuration ALLOWED_ORIGINS="https://your-render-site.onrender.com,http://localhost:5173"
```

Deploy:

```powershell
modal deploy backend/modal_app.py
```

Modal prints an HTTPS Web Function URL. Test `URL/health` (a cold start can be slow). For `/analyze`, the frontend sends a multipart `file` field. Current server limits: 25 MB and eight minutes; GPU inference and warmup may take longer than browser/request timeouts for longer songs.

Note: The Modal image downloads and installs Demucs and its dependencies. The first container may also download pretrained model weights. Model download/cold starts can be slow. If model dependency versions or provider GPU availability change, deployment/runtime may require adjustment.

## 3. Local React connection

Create `.env.local` in repo root (not committed):

```ini
VITE_ANALYSIS_API_URL=https://YOUR-ACTUAL-MODAL-ENDPOINT.modal.run
```

This must be the exact Modal URL printed by `modal deploy`, **without `/analyze`**. Restart Vite (`npm run dev`) and upload an MP3 below 25 MB. If the GPU service fails, the hook silently switches to your existing local browser separator. For a browser-only run, remove the variable.

## 4. Render Static Site

Push your committed changes to GitHub first, then create a **Static Site**, not a Web Service:

- Repo: `mcartv/song-painter`
- Branch: your merged deployment branch (or feature branch for beta)
- Build: `npm ci && npm run build`
- Publish: `dist`
- Environment: `VITE_ANALYSIS_API_URL` = your full Modal endpoint URL (this URL is **public**, never a secret)

Static Vite environment variables are embedded at **build time**. After changing `VITE_ANALYSIS_API_URL`, redeploy/rebuild the site.

For a public website, **leave the API URL unset** until authentication, rate limiting, abuse protection, and cost controls are deployed. A web UI cannot safely conceal a shared GPU API key. For initial private testing, only share the URL with a trusted tester and set a low Modal spending limit.

## 5. Suggested Git workflow

```powershell
git status
git switch -c feat/hybrid-gpu-analysis
npm run build
npm run test
git add src/hooks/useVocalAnalysis.ts src/hooks/useBrowserVocalAnalysis.ts src/hooks/useRemoteVocalAnalysis.ts backend/modal_app.py backend/requirements.txt docs/HYBRID_DEPLOYMENT.md .env.backend.example
git commit -m "feat: add Modal GPU analysis with browser fallback"
git push -u origin feat/hybrid-gpu-analysis
```

Create a GitHub Pull Request from `feat/hybrid-gpu-analysis` into `master`. Merge only after runtime testing. Avoid `git add .` because your folder has extracted patchers, backups and possibly local `.env` files.

## 6. Rollback

Before making further source edits:

```powershell
node .\song-painter-hybrid-backend-v7\install-patch.cjs --undo
```

Rollback refuses if any installed file was modified since installation. Git can also restore committed changes on your branch.

## Limitations

- The server uses **Demucs**, not the browser SCNet model, so results may differ (but all timelines use compatible 50-fps layout).
- The backend currently returns results only when an entire song completes; its HTTP request is **not** a job queue. Progress remains indeterminate during GPU analysis.
- Switching to browser fallback on remote failure can be slow (same as v6).
- The browser-only v6 still works without a Modal account or GPU endpoint.
- Requires real testing against a deployed GPU endpoint, production browser, and varying audio formats before public launch.
