"""
VISION — MADE BY LOKESH | Persistent Inference Worker Daemon (`ml_foundation/worker.py`)
Loads a verified PyTorch model bundle once in memory and serves warm, queued,
cancellable, memory-bounded multimodal inference over loopback HTTP.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
import gc
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import queue
import signal
import sys
import threading
import time
from typing import Dict, Optional, Tuple
import uuid

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.inference import _load_bundle, run_infer_on_bundle


@dataclass
class InferenceJob:
    request_id: str
    checkpoint_dir: str
    prompt: str
    image_path: Optional[str] = None
    audio_path: Optional[str] = None
    max_tokens: int = 48
    temperature: float = 0.05
    enqueued_at: float = field(default_factory=time.perf_counter)
    cancel_event: threading.Event = field(default_factory=threading.Event)
    done_event: threading.Event = field(default_factory=threading.Event)
    status_code: int = 200
    result: Dict[str, object] = field(default_factory=dict)


class WorkerRuntime:
    """Thread-safe persistent model runtime with FIFO request queue and memory guard."""

    def __init__(
        self,
        checkpoint_dir: str = "",
        max_queue_size: int = 16,
        max_rss_mb: float = 1536.0,
    ) -> None:
        self.start_time = time.time()
        self.max_queue_size = max(1, int(max_queue_size))
        self.max_rss_mb = max(128.0, float(max_rss_mb))
        self.job_queue: queue.Queue[Optional[InferenceJob]] = queue.Queue(maxsize=self.max_queue_size)

        self._lock = threading.RLock()
        self._bundle_lock = threading.RLock()
        self.active_checkpoint_dir: str = ""
        self.active_bundle: Optional[Tuple[object, object, object]] = None
        self.loaded_version: str = ""

        self.jobs_by_id: Dict[str, InferenceJob] = {}
        self.active_request_id: Optional[str] = None
        self.total_requests = 0
        self.completed_requests = 0
        self.cancelled_requests = 0
        self.failed_requests = 0
        self.last_infer_ms = 0.0
        self.total_infer_ms = 0.0
        self.shutting_down = False
        self._http_server: Optional[ThreadingHTTPServer] = None

        if checkpoint_dir:
            self.load_checkpoint(checkpoint_dir)

        self._worker_thread = threading.Thread(target=self._worker_loop, name="vision-worker-loop", daemon=True)
        self._worker_thread.start()

    def load_checkpoint(self, checkpoint_dir: str) -> Dict[str, object]:
        resolved = os.path.abspath(checkpoint_dir)
        with self._bundle_lock:
            bundle = _load_bundle(resolved)
            self.active_checkpoint_dir = resolved
            self.active_bundle = bundle
            self.loaded_version = str(bundle[2].version)
            gc.collect()
        return {
            "success": True,
            "loaded_version": self.loaded_version,
            "checkpoint_dir": self.active_checkpoint_dir,
            "rss_mb": _get_process_rss_mb(),
        }

    def check_memory(self) -> Tuple[bool, float]:
        rss = _get_process_rss_mb()
        if rss > self.max_rss_mb:
            gc.collect()
            rss = _get_process_rss_mb()
        return (rss <= self.max_rss_mb, rss)

    def health_snapshot(self, port: int) -> Dict[str, object]:
        mem_ok, rss = self.check_memory()
        with self._lock:
            avg_ms = (
                round(self.total_infer_ms / self.completed_requests, 2)
                if self.completed_requests > 0
                else 0.0
            )
            return {
                "ok": (not self.shutting_down) and mem_ok,
                "pid": os.getpid(),
                "port": port,
                "loaded": self.active_bundle is not None,
                "loaded_version": self.loaded_version,
                "checkpoint_dir": self.active_checkpoint_dir,
                "uptime_s": round(time.time() - self.start_time, 2),
                "queue_depth": self.job_queue.qsize(),
                "max_queue_size": self.max_queue_size,
                "active_request_id": self.active_request_id,
                "total_requests": self.total_requests,
                "completed_requests": self.completed_requests,
                "cancelled_requests": self.cancelled_requests,
                "failed_requests": self.failed_requests,
                "rss_mb": rss,
                "max_rss_mb": self.max_rss_mb,
                "memory_ok": mem_ok,
                "last_infer_ms": self.last_infer_ms,
                "avg_infer_ms": avg_ms,
            }

    def submit_job(self, job: InferenceJob, timeout_s: float = 120.0) -> Tuple[int, Dict[str, object]]:
        if self.shutting_down:
            return 503, {"success": False, "error": "WORKER_SHUTTING_DOWN", "request_id": job.request_id}

        mem_ok, rss = self.check_memory()
        if not mem_ok:
            return 503, {
                "success": False,
                "error": "MEMORY_LIMIT_EXCEEDED",
                "rss_mb": rss,
                "max_rss_mb": self.max_rss_mb,
                "request_id": job.request_id,
            }

        with self._lock:
            self.total_requests += 1
            self.jobs_by_id[job.request_id] = job
            try:
                self.job_queue.put_nowait(job)
            except queue.Full:
                self.jobs_by_id.pop(job.request_id, None)
                self.failed_requests += 1
                return 429, {
                    "success": False,
                    "error": "WORKER_QUEUE_FULL",
                    "queue_depth": self.job_queue.qsize(),
                    "max_queue_size": self.max_queue_size,
                    "request_id": job.request_id,
                }

        finished = job.done_event.wait(timeout=max(1.0, float(timeout_s)))
        with self._lock:
            self.jobs_by_id.pop(job.request_id, None)
        if not finished:
            job.cancel_event.set()
            return 504, {
                "success": False,
                "cancelled": True,
                "error": "WORKER_INFER_TIMEOUT",
                "request_id": job.request_id,
            }
        return job.status_code, job.result

    def cancel_job(self, request_id: str) -> Dict[str, object]:
        with self._lock:
            job = self.jobs_by_id.get(request_id)
            if job is None:
                return {"success": True, "request_id": request_id, "cancelled": False, "reason": "not_active"}
            already = job.cancel_event.is_set()
            job.cancel_event.set()
            return {"success": True, "request_id": request_id, "cancelled": True, "already_cancelled": already}

    def _worker_loop(self) -> None:
        while not self.shutting_down:
            job = self.job_queue.get()
            if job is None:
                self.job_queue.task_done()
                break

            queue_wait_ms = round((time.perf_counter() - job.enqueued_at) * 1000.0, 2)
            with self._lock:
                self.active_request_id = job.request_id

            try:
                if job.cancel_event.is_set():
                    with self._lock:
                        self.cancelled_requests += 1
                    job.status_code = 499
                    job.result = {
                        "success": False,
                        "cancelled": True,
                        "error": "INFERENCE_CANCELLED_IN_QUEUE",
                        "request_id": job.request_id,
                        "queue_wait_ms": queue_wait_ms,
                    }
                else:
                    target_ckpt = os.path.abspath(job.checkpoint_dir) if job.checkpoint_dir else self.active_checkpoint_dir
                    if not target_ckpt:
                        raise FileNotFoundError("No checkpoint_dir loaded or provided")

                    if self.active_bundle is None or target_ckpt != self.active_checkpoint_dir:
                        self.load_checkpoint(target_ckpt)

                    with self._bundle_lock:
                        model, tokenizer, cfg = self.active_bundle
                        res = run_infer_on_bundle(
                            model,
                            tokenizer,
                            cfg,
                            prompt=job.prompt,
                            image_path=job.image_path,
                            audio_path=job.audio_path,
                            max_new_tokens=job.max_tokens,
                            temperature=job.temperature,
                            cancel_check=job.cancel_event.is_set,
                        )

                    res["request_id"] = job.request_id
                    res["queue_wait_ms"] = queue_wait_ms
                    res["worker_pid"] = os.getpid()
                    res["warm_worker"] = True
                    res["rss_mb"] = _get_process_rss_mb()

                    if res.get("cancelled"):
                        with self._lock:
                            self.cancelled_requests += 1
                        job.status_code = 499
                    else:
                        lat = float(res.get("latency_ms", 0.0))
                        with self._lock:
                            self.completed_requests += 1
                            self.last_infer_ms = lat
                            self.total_infer_ms += lat
                        job.status_code = 200
                    job.result = res
            except Exception as exc:
                with self._lock:
                    self.failed_requests += 1
                job.status_code = 500
                job.result = {
                    "success": False,
                    "error": str(exc),
                    "request_id": job.request_id,
                    "queue_wait_ms": queue_wait_ms,
                    "rss_mb": _get_process_rss_mb(),
                }
            finally:
                with self._lock:
                    self.active_request_id = None
                job.done_event.set()
                self.job_queue.task_done()

    def request_shutdown(self) -> None:
        if self.shutting_down:
            return
        self.shutting_down = True
        with self._lock:
            for job in list(self.jobs_by_id.values()):
                job.cancel_event.set()
        try:
            self.job_queue.put_nowait(None)
        except queue.Full:
            pass
        if self._http_server is not None:
            threading.Thread(target=self._http_server.shutdown, daemon=True).start()


def make_handler(runtime: WorkerRuntime):
    class WorkerHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args) -> None:
            # Keep stdout reserved cleanly for WORKER_READY banner; errors go to stderr on exceptions.
            return

        def _send_json(self, code: int, payload: Dict[str, object]) -> None:
            raw = json.dumps(payload).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(raw)

        def _read_json(self) -> Dict[str, object]:
            length = int(self.headers.get("Content-Length", "0") or 0)
            if length <= 0:
                return {}
            body = self.rfile.read(length)
            return json.loads(body.decode("utf-8")) if body else {}

        def do_GET(self) -> None:
            if self.path.split("?")[0] == "/health":
                snap = runtime.health_snapshot(self.server.server_port)
                self._send_json(200 if snap["ok"] else 503, snap)
                return
            self._send_json(404, {"success": False, "error": f"Unknown endpoint: {self.path}"})

        def do_POST(self) -> None:
            route = self.path.split("?")[0]
            try:
                body = self._read_json()
            except Exception as exc:
                self._send_json(400, {"success": False, "error": f"Invalid JSON: {exc}"})
                return

            if route == "/infer":
                req_id = str(body.get("request_id") or uuid.uuid4().hex[:12])
                job = InferenceJob(
                    request_id=req_id,
                    checkpoint_dir=str(body.get("checkpoint_dir") or ""),
                    prompt=str(body.get("prompt") or ""),
                    image_path=str(body.get("image_path") or "") or None,
                    audio_path=str(body.get("audio_path") or "") or None,
                    max_tokens=max(1, min(1024, int(body.get("max_tokens", 48)))),
                    temperature=float(body.get("temperature", 0.05)),
                )
                timeout_s = float(body.get("timeout_s", 120.0))
                code, res = runtime.submit_job(job, timeout_s=timeout_s)
                self._send_json(code, res)
                return

            if route == "/cancel":
                req_id = str(body.get("request_id") or "").strip()
                if not req_id:
                    self._send_json(400, {"success": False, "error": "request_id required"})
                    return
                self._send_json(200, runtime.cancel_job(req_id))
                return

            if route == "/reload":
                ckpt_dir = str(body.get("checkpoint_dir") or "").strip()
                if not ckpt_dir:
                    self._send_json(400, {"success": False, "error": "checkpoint_dir required"})
                    return
                try:
                    info = runtime.load_checkpoint(ckpt_dir)
                    self._send_json(200, info)
                except Exception as exc:
                    self._send_json(500, {"success": False, "error": str(exc)})
                return

            if route == "/shutdown":
                self._send_json(200, {"success": True, "shutting_down": True})
                runtime.request_shutdown()
                return

            self._send_json(404, {"success": False, "error": f"Unknown endpoint: {self.path}"})

    return WorkerHandler


def _start_stdin_watchdog(runtime: WorkerRuntime) -> None:
    def _watch() -> None:
        try:
            while not runtime.shutting_down:
                chunk = sys.stdin.read(1)
                if chunk == "":
                    break
        except Exception:
            pass
        runtime.request_shutdown()

    threading.Thread(target=_watch, name="stdin-eof-watchdog", daemon=True).start()


def main() -> None:
    parser = argparse.ArgumentParser(description="VISION Persistent Inference Worker")
    parser.add_argument("--checkpoint-dir", default="")
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--max-queue-size", type=int, default=16)
    parser.add_argument("--max-rss-mb", type=float, default=1536.0)
    parser.add_argument("--no-stdin-watchdog", action="store_true")
    args = parser.parse_args()

    runtime = WorkerRuntime(
        checkpoint_dir=args.checkpoint_dir,
        max_queue_size=args.max_queue_size,
        max_rss_mb=args.max_rss_mb,
    )

    class ReusableThreadingHTTPServer(ThreadingHTTPServer):
        allow_reuse_address = True
        daemon_threads = True

    server = ReusableThreadingHTTPServer(("127.0.0.1", args.port), make_handler(runtime))
    runtime._http_server = server

    def _on_signal(_signum, _frame):
        runtime.request_shutdown()

    signal.signal(signal.SIGINT, _on_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _on_signal)

    if not args.no_stdin_watchdog:
        _start_stdin_watchdog(runtime)

    banner = {
        "port": int(server.server_port),
        "pid": os.getpid(),
        "checkpoint_dir": runtime.active_checkpoint_dir,
        "loaded_version": runtime.loaded_version,
        "rss_mb": _get_process_rss_mb(),
    }
    print(f"WORKER_READY {json.dumps(banner)}", flush=True)

    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        runtime.request_shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
