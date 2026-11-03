"""Song Painter analysis service (optimized v8).

One container-local Demucs instance; no database, no persistent audio files.
IMPORTANT: This is NOT publicly safe without authentication and usage controls.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import tempfile
import time
from pathlib import Path

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
SR = 8000


def analyze_audio(upload_bytes: bytes, suffix: str, separator) -> dict:
    import librosa
    import numpy as np
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly

    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="song-painter-") as tmp:
        work = Path(tmp)
        source = work / ("upload" + suffix)
        source.write_bytes(upload_bytes)
        wav = work / "decoded.wav"

        # Decode once. No two large separated-stem WAVs are written.
        decode = subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source),
             "-ac", "2", "-ar", "44100", "-acodec", "pcm_f32le", str(wav)],
            capture_output=True, timeout=90,
        )
        if decode.returncode != 0:
            raise ValueError("Audio decoding failed")

        samples, sample_rate = sf.read(str(wav), dtype="float32", always_2d=True)
        duration = len(samples) / sample_rate
        if not math.isfinite(duration) or duration <= 0 or duration > MAX_DURATION_SECONDS:
            raise ValueError("Audio must be between 1 second and 8 minutes")
        frame_count = max(1, math.ceil(duration * FPS))
        decoded_at = time.monotonic()

        with torch.inference_mode():
            # API uses one cached model in this container; tensor is stereo x frames.
            _, stems = separator.separate_tensor(torch.from_numpy(samples.T.copy()), sr=sample_rate)
        separated_at = time.monotonic()
        if "vocals" not in stems:
            raise RuntimeError("Separation did not return vocals")

        # The original mixture is the sum of all stems, so accompaniment is
        # reconstructed without writing an extra file or re-running inference.
        vocals = stems["vocals"].mean(dim=0).cpu().numpy()
        accompaniment = sum(
            (stem.mean(dim=0).cpu().numpy() for name, stem in stems.items() if name != "vocals"),
            np.zeros_like(vocals),
        )

        # Downsample for a small analysis timeline, and drop 44.1k data.
        vocal_8k = resample_poly(vocals, 80, 441).astype(np.float32, copy=False)
        music_8k = resample_poly(accompaniment, 80, 441).astype(np.float32, copy=False)
        del samples, stems, vocals, accompaniment

        def envelope(data: np.ndarray) -> np.ndarray:
            hop = SR // FPS
            required = frame_count * hop
            if len(data) < required:
                data = np.pad(data, (0, required - len(data)))
            else:
                data = data[:required]
            frames = data.reshape(frame_count, hop)
            rms = np.sqrt(np.mean(frames * frames, axis=1))
            lo, hi = np.percentile(rms, [20, 95])
            if hi < 0.0001:
                return np.zeros(frame_count, dtype=np.float32)
            return np.clip((rms - lo) / max(1e-5, hi - lo), 0, 1)

        vocal_levels = envelope(vocal_8k)
        music_levels = envelope(music_8k)
        pitches = np.zeros(frame_count, dtype=np.float32)
        # Match 50 FPS, but only estimate pitch if there is real vocal energy.
        if np.any(vocal_levels >= 0.16):
            f0 = librosa.yin(
                vocal_8k, fmin=90.0, fmax=900.0, sr=SR,
                frame_length=2048, hop_length=SR // FPS, center=True,
            )
            n = min(len(f0), frame_count)
            midi = 69.0 + 12.0 * np.log2(np.maximum(f0[:n], 1e-6) / 440.0)
            active = (vocal_levels[:n] >= 0.16) & (midi >= 29) & (midi <= 90)
            pitches[:n] = np.where(active, midi, 0).astype(np.float32)

        def rounded(data: np.ndarray) -> list[float]:
            return np.round(data, 3).astype(float).tolist()

        print(json.dumps({
            "metric": "analysis_seconds",
            "decode": round(decoded_at - started, 3),
            "separation": round(separated_at - decoded_at, 3),
            "timelines": round(time.monotonic() - separated_at, 3),
            "song_seconds": round(duration, 2),
        }))
        return {
            "framesPerSecond": FPS,
            "levels": rounded(vocal_levels),
            "pitches": rounded(pitches),
            "musicLevels": rounded(music_levels),
        }


@app.function(
    image=image, gpu="T4", timeout=600, max_containers=1,
    secrets=[modal.Secret.from_name("song-painter-configuration")],
)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, File, HTTPException, UploadFile
    from fastapi.concurrency import run_in_threadpool
    from fastapi.middleware.cors import CORSMiddleware
    from demucs.api import Separator

    # Warm-container model reuse: initialized once per ASGI app instance.
    # A cold container still needs to initialize/download model weights.
    separator = Separator(model="htdemucs", device="cuda", shifts=1, overlap=0.25,
                          split=True, segment=7)
    web = FastAPI(title="Song Painter Analysis", docs_url=None, redoc_url=None)
    origins = [s.strip() for s in os.environ.get("ALLOWED_ORIGINS", "").split(",") if s.strip()]
    web.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_methods=["POST", "GET"],
        allow_headers=["Content-Type"],
    )

    @web.get("/health")
    def health():
        return {"status": "ok", "service": "song-painter-analysis"}

    @web.post("/analyze")
    async def analyze(file: UploadFile = File(...)):
        # IMPORTANT: CORS is not authentication. Require auth and quotas before public use.
        suffix = Path(file.filename or "song.mp3").suffix.lower()
        if suffix not in {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"}:
            raise HTTPException(status_code=415, detail="Unsupported audio file extension")
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        if not data:
            raise HTTPException(status_code=400, detail="Empty file")
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 25 MB limit")
        try:
            return await run_in_threadpool(analyze_audio, data, suffix, separator)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            print("Analysis failed:", type(exc).__name__, str(exc)[:200])
            raise HTTPException(status_code=500, detail="Audio analysis failed") from exc

    return web
