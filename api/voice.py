"""
POST /api/voice  {"text": "..."}  ->  audio/wav

Reads a volunteer's brief in Kokoro's "Heart" voice (Kokoro-82M, Apache 2.0),
the same voice as the launch film. Runs on Vercel's Python runtime; the int8
model (92 MB) and voices (28 MB) download to /tmp on a cold start and stay
loaded while the instance is warm. No API credits are used.

Same speed bumps as the AI routes: our own site only, a per-visitor rate
limit, and a cap on how much text it will read.
"""
import io
import json
import os
import re
import threading
import time
import urllib.request
import wave
from http.server import BaseHTTPRequestHandler

import numpy as np

RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
MODEL = ("kokoro-v1.0.int8.onnx", 92361271)
VOICES = ("voices-v1.0.bin", 28214398)
CACHE = "/tmp/kokoro"
VOICE = "af_heart"

MAX_CHARS = 700
WINDOW_S = 10 * 60
PER_VISITOR = 40
PER_INSTANCE_PER_HOUR = 400

_lock = threading.Lock()
_kokoro = None
_hits: dict[str, list[float]] = {}
_recent: list[float] = []
_clips: dict[str, bytes] = {}


def _fetch(name: str, size: int) -> str:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not (os.path.exists(path) and os.path.getsize(path) == size):
        tmp = path + ".part"
        urllib.request.urlretrieve(f"{RELEASE}/{name}", tmp)
        os.replace(tmp, path)
    return path


def _model():
    global _kokoro
    with _lock:
        if _kokoro is None:
            from kokoro_onnx import Kokoro

            _kokoro = Kokoro(_fetch(*MODEL), _fetch(*VOICES))
    return _kokoro


def _allowed(origin: str) -> bool:
    if not origin:
        return False
    listed = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    for key in ("VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL", "VERCEL_BRANCH_URL"):
        if os.environ.get(key):
            listed.append(f"https://{os.environ[key]}")
    return origin in listed or re.fullmatch(r"https://ground-control[a-z0-9-]*\.vercel\.app", origin) is not None


def _limited(visitor: str) -> bool:
    global _recent
    now = time.time()
    mine = [t for t in _hits.get(visitor, []) if now - t < WINDOW_S]
    _recent = [t for t in _recent if now - t < 3600]
    if len(mine) >= PER_VISITOR or len(_recent) >= PER_INSTANCE_PER_HOUR:
        return True
    mine.append(now)
    _recent.append(now)
    if len(_hits) > 5000:
        _hits.clear()
    _hits[visitor] = mine
    return False


def _wav(samples: np.ndarray, rate: int) -> bytes:
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return out.getvalue()


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, kind: str, origin: str | None = None):
        self.send_response(status)
        self.send_header("content-type", kind)
        self.send_header("content-length", str(len(body)))
        if origin:
            self.send_header("access-control-allow-origin", origin)
            self.send_header("vary", "origin")
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, reason: str):
        self._send(status, json.dumps({"ok": False, "reason": reason}).encode(), "application/json")

    def do_OPTIONS(self):
        origin = self.headers.get("origin", "")
        self.send_response(204)
        if _allowed(origin):
            self.send_header("access-control-allow-origin", origin)
            self.send_header("access-control-allow-methods", "POST, OPTIONS")
            self.send_header("access-control-allow-headers", "content-type")
        self.end_headers()

    def do_POST(self):
        origin = self.headers.get("origin", "")
        if not _allowed(origin):
            return self._error(403, "Not allowed from this site")
        size = int(self.headers.get("content-length") or 0)
        if size <= 0 or size > 4 * MAX_CHARS:
            return self._error(413, "Request too large")
        try:
            text = str(json.loads(self.rfile.read(size)).get("text", "")).strip()
        except Exception:
            return self._error(400, "bad request")
        if not text or len(text) > MAX_CHARS:
            return self._error(400, "text must be 1 to 700 characters")
        visitor = (self.headers.get("x-forwarded-for") or "").split(",")[0].strip() or "unknown"

        clip = _clips.get(text)
        if clip is None:
            if _limited(visitor):
                return self._error(429, "Too many voice requests. Try again in a few minutes.")
            try:
                samples, rate = _model().create(text, voice=VOICE, speed=1.0, lang="en-us")
            except Exception as e:  # the app falls back to the phone's own voice
                return self._error(503, f"voice unavailable: {type(e).__name__}")
            clip = _wav(samples, rate)
            if len(_clips) > 64:
                _clips.clear()
            _clips[text] = clip
        self._send(200, clip, "audio/wav", origin)
