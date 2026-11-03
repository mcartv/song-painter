# Song Painter v8 — backend optimizer (no database)

Changes **only** `backend/modal_app.py` from the exact v7 patch. Does not modify React, mirroring, export or browser fallback.

Run from repository root:

```powershell
node .\song-painter-backend-optimizer-v8\install-patch.cjs --check
node .\song-painter-backend-optimizer-v8\install-patch.cjs --install
python -m py_compile backend/modal_app.py
modal deploy backend/modal_app.py
```

If you modified the v7 backend, the guard refuses to overwrite it. For rollback:

```powershell
node .\song-painter-backend-optimizer-v8\install-patch.cjs --undo
```

**Expected improvements:** one Demucs model per warm container, no per-request Python subprocess for separation, no large intermediate stem WAVs. Same API schema and upload limits. Uses 44.1k stereo WAV decoding, 8k 50 FPS envelope/pitch, Demucs htdemucs on T4. Latency metrics logged by stage.

**Not guaranteed faster:** model cold start, song length, GPU availability, upload, and `librosa.yin` remain bottlenecks. No benchmark or live GPU run completed. No persistent files or database.

**Security:** The API is still public if deployed; CORS is not authentication. Do not expose an unrestricted billable Modal GPU URL publicly. Add server-side authentication, quotas and cost controls before launch.

**Deployment:** Push updated `backend/modal_app.py` to GitHub, then rerun `modal deploy backend/modal_app.py` from local checkout; deploying Render static site does **not** deploy the Modal endpoint.
