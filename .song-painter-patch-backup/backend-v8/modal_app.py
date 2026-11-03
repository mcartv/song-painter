"""Song Painter GPU analysis endpoint — deploy with: modal deploy backend/modal_app.py.

WARNING: The endpoint is public if deployed. CORS is not authentication.
For an invite-only prototype only; add server-verified auth and quotas before public launch.
"""
from __future__ import annotations

import os

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "fastapi==0.115.12",
        "python-multipart==0.0.20",
        "numpy==1.26.4",
        "scipy==1.13.1",
        "soundfile==0.13.1",
        "librosa==0.10.2.post1",
        "torch==2.3.1",
        "torchaudio==2.3.1",
        "demucs==4.0.1",
    )
)
app = modal.App("song-painter-gpu-analysis")

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_DURATION_SECONDS = 8 * 60
FPS = 50


def analyze_audio(upload_bytes: bytes, suffix: str) -> dict:
    import json
    import math
    import subprocess
    import tempfile
    from pathlib import Path

    import librosa
    import numpy as np

    def run(cmd: list[str], timeout: int):
        completed = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if completed.returncode != 0:
            # Return a bounded, non-sensitive diagnostic to the server logs only.
            print("processing command failed:", completed.stderr[-1000:])
            raise RuntimeError("Audio decoding or separation failed")
        return completed.stdout

    def envelope(samples: np.ndarray, frame_count: int) -> np.ndarray:
        hop = 8000 // FPS
        expected = frame_count * hop
        if len(samples) < expected:
            samples = np.pad(samples, (0, expected - len(samples)))
        else:
            samples = samples[:expected]
        frames = samples.reshape(frame_count, hop)
        rms = np.sqrt(np.mean(frames * frames, axis=1))
        if not len(rms):
            return rms
        lo, hi = np.percentile(rms, [20, 95])
        if hi < 0.0001:
            return np.zeros_like(rms)
        return np.clip((rms - lo) / max(1e-5, hi - lo), 0, 1)

    with tempfile.TemporaryDirectory(prefix="song-painter-") as temp:
        work = Path(temp)
        source = work / ("upload" + suffix)
        source.write_bytes(upload_bytes)
        wav = work / "song.wav"
        # Convert to stereo 44.1k WAV so Demucs sees predictable input.
        run(["ffmpeg", "-v", "error", "-y", "-i", str(source), "-ac", "2", "-ar", "44100", str(wav)], 90)
        probe = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(wav)], 15)
        duration = float(json.loads(probe)["format"]["duration"])
        if not math.isfinite(duration) or duration <= 0 or duration > MAX_DURATION_SECONDS:
            raise ValueError("Audio must be between 1 second and 8 minutes")

        run([
            "python", "-m", "demucs", "--two-stems", "vocals", "-n", "htdemucs",
            "-d", "cuda", "--segment", "7", "-o", str(work / "separated"), str(wav),
        ], 500)

        stems = work / "separated" / "htdemucs" / "song"
        vocal_file = stems / "vocals.wav"
        music_file = stems / "no_vocals.wav"
        if not vocal_file.exists() or not music_file.exists():
            raise RuntimeError("Separation did not produce the expected stems")

        # 8k mono provides 50 Hz activity/pitch tracks at modest memory cost.
        vocal, sr = librosa.load(str(vocal_file), sr=8000, mono=True)
        music, _ = librosa.load(str(music_file), sr=8000, mono=True)
        frame_count = max(1, math.ceil(duration * FPS))
        vocal_levels = envelope(vocal, frame_count)
        music_levels = envelope(music, frame_count)

        pitch = np.zeros(frame_count, dtype=np.float32)
        # MIDI values, same units as the browser's v4 pitch tracker.
        f0 = librosa.yin(vocal, fmin=90.0, fmax=900.0, sr=sr,
                         frame_length=2048, hop_length=sr // FPS, center=True)
        count = min(len(pitch), len(f0))
        safe_f0 = np.maximum(f0[:count], 1e-6)
        midi = 69.0 + 12.0 * np.log2(safe_f0 / 440.0)
        mask = (vocal_levels[:count] >= 0.16) & (midi >= 29) & (midi <= 90)
        pitch[:count] = np.where(mask, midi, 0).astype(np.float32)

        def rounded(a: np.ndarray) -> list[float]:
            return np.round(a, 3).astype(float).tolist()

        return {
            "framesPerSecond": FPS,
            "levels": rounded(vocal_levels),
            "pitches": rounded(pitch),
            "musicLevels": rounded(music_levels),
        }


@app.function(
    image=image, gpu="T4", timeout=600, max_containers=1,
    secrets=[modal.Secret.from_name("song-painter-configuration")],
)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, File, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware

    web = FastAPI(title="Song Painter Analysis", docs_url=None, redoc_url=None)
    origins = [x.strip() for x in os.environ.get("ALLOWED_ORIGINS", "").split(",") if x.strip()]
    web.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["POST", "GET"], allow_headers=["Content-Type"])

    @web.get("/health")
    def health():
        return {"status": "ok", "service": "song-painter-analysis"}

    @web.post("/analyze")
    async def analyze(file: UploadFile = File(...)):
        # This public endpoint requires real server-side authentication and
        # rate limiting before it is opened to general traffic.
        suffix = os.path.splitext(file.filename or "song.mp3")[1].lower()
        if suffix not in {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"}:
            raise HTTPException(status_code=415, detail="Unsupported audio file extension")
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 25 MB limit")
        if not data:
            raise HTTPException(status_code=400, detail="Empty file")
        try:
            return analyze_audio(data, suffix)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            print("Analysis failed:", type(exc).__name__, str(exc)[:200])
            raise HTTPException(status_code=500, detail="Audio analysis failed") from exc

    return web
