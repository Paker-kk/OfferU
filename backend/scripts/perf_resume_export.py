"""Resume image export performance test.

Targets /api/resume/{id}/export/image and reports latency percentiles,
error rate, throughput, and cache hit ratio.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import math
import statistics
import time
from dataclasses import dataclass
from typing import Iterable

import requests


@dataclass
class ProbeResult:
    ok: bool
    status_code: int
    latency_ms: float
    size_bytes: int
    cache_state: str
    error: str = ""


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    if p <= 0:
        return min(values)
    if p >= 100:
        return max(values)

    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * (p / 100.0)
    floor = math.floor(k)
    ceil = math.ceil(k)
    if floor == ceil:
        return sorted_vals[int(k)]
    d0 = sorted_vals[floor] * (ceil - k)
    d1 = sorted_vals[ceil] * (k - floor)
    return d0 + d1


def build_url(base_url: str, resume_id: int, scale: float) -> str:
    return f"{base_url.rstrip('/')}/api/resume/{resume_id}/export/image?scale={scale}"


def run_once(session: requests.Session, method: str, url: str, timeout: float) -> ProbeResult:
    start = time.perf_counter()
    try:
        if method == "get":
            response = session.get(url, timeout=timeout)
        else:
            response = session.post(url, timeout=timeout)
        latency_ms = (time.perf_counter() - start) * 1000

        cache_state = response.headers.get("X-OfferU-Export-Cache", "none").lower()
        size_bytes = len(response.content)
        ok = response.status_code == 200

        return ProbeResult(
            ok=ok,
            status_code=response.status_code,
            latency_ms=latency_ms,
            size_bytes=size_bytes,
            cache_state=cache_state,
            error="" if ok else response.text[:160],
        )
    except Exception as exc:  # network/timeout
        latency_ms = (time.perf_counter() - start) * 1000
        return ProbeResult(
            ok=False,
            status_code=0,
            latency_ms=latency_ms,
            size_bytes=0,
            cache_state="none",
            error=str(exc),
        )


def run_warmup(session: requests.Session, method: str, url: str, timeout: float, warmup: int) -> None:
    for _ in range(max(0, warmup)):
        run_once(session, method, url, timeout)


def run_batch(
    base_url: str,
    resume_id: int,
    method: str,
    scale: float,
    total_requests: int,
    concurrency: int,
    timeout: float,
) -> list[ProbeResult]:
    url = build_url(base_url, resume_id, scale)

    def task(_: int) -> ProbeResult:
        with requests.Session() as session:
            session.trust_env = False
            return run_once(session, method, url, timeout)

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        return list(pool.map(task, range(total_requests)))


def summarize(results: Iterable[ProbeResult], elapsed_s: float) -> None:
    all_results = list(results)
    latencies = [r.latency_ms for r in all_results]
    ok_results = [r for r in all_results if r.ok]
    ok_latencies = [r.latency_ms for r in ok_results]

    total = len(all_results)
    ok_count = len(ok_results)
    fail_count = total - ok_count
    fail_rate = (fail_count / total * 100) if total else 0.0

    hit_count = sum(1 for r in ok_results if r.cache_state == "hit")
    miss_count = sum(1 for r in ok_results if r.cache_state == "miss")
    hit_ratio = (hit_count / ok_count * 100) if ok_count else 0.0

    avg_size = statistics.mean([r.size_bytes for r in ok_results]) if ok_results else 0.0
    rps = (total / elapsed_s) if elapsed_s > 0 else 0.0

    p50 = percentile(ok_latencies, 50)
    p90 = percentile(ok_latencies, 90)
    p95 = percentile(ok_latencies, 95)
    p99 = percentile(ok_latencies, 99)
    avg = statistics.mean(ok_latencies) if ok_latencies else 0.0

    print("=== Resume Export Image Performance ===")
    print(f"Total requests: {total}")
    print(f"Success: {ok_count}")
    print(f"Failure: {fail_count}")
    print(f"Failure rate: {fail_rate:.2f}%")
    print(f"Elapsed: {elapsed_s:.2f}s")
    print(f"Throughput: {rps:.2f} req/s")
    print(f"Average payload: {avg_size:.0f} bytes")
    print(f"Cache hit: {hit_count} | miss: {miss_count} | hit ratio: {hit_ratio:.2f}%")
    print()

    if ok_latencies:
        print("Latency on successful responses (ms):")
        print(f"  min={min(ok_latencies):.2f} max={max(ok_latencies):.2f} avg={avg:.2f}")
        print(f"  p50={p50:.2f} p90={p90:.2f} p95={p95:.2f} p99={p99:.2f}")
    else:
        print("Latency on successful responses (ms): no successful responses")

    print()
    print("SLO checks:")
    print(f"  p95 <= 3000ms: {'PASS' if p95 <= 3000 else 'FAIL'}")
    print(f"  failure rate < 1%: {'PASS' if fail_rate < 1 else 'FAIL'}")

    if fail_count:
        print()
        print("Sample failures:")
        sample = [r for r in all_results if not r.ok][:5]
        for idx, item in enumerate(sample, start=1):
            print(f"  {idx}. status={item.status_code}, latency={item.latency_ms:.2f}ms, error={item.error}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Performance test for resume image export endpoint")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="API base URL")
    parser.add_argument("--resume-id", type=int, required=True, help="Resume ID to export")
    parser.add_argument("--scale", type=float, default=1.2, help="Export image scale")
    parser.add_argument("--method", choices=["get", "post"], default="get", help="HTTP method")
    parser.add_argument("--warmup", type=int, default=3, help="Warmup requests before measurement")
    parser.add_argument("--requests", type=int, default=20, help="Measured request count")
    parser.add_argument("--concurrency", type=int, default=4, help="Concurrent workers")
    parser.add_argument("--timeout", type=float, default=20.0, help="Per request timeout seconds")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    url = build_url(args.base_url, args.resume_id, args.scale)

    print("Warmup...")
    with requests.Session() as warmup_session:
        warmup_session.trust_env = False
        run_warmup(warmup_session, args.method, url, args.timeout, args.warmup)

    print("Running measured batch...")
    start = time.perf_counter()
    results = run_batch(
        base_url=args.base_url,
        resume_id=args.resume_id,
        method=args.method,
        scale=args.scale,
        total_requests=args.requests,
        concurrency=args.concurrency,
        timeout=args.timeout,
    )
    elapsed_s = time.perf_counter() - start

    summarize(results, elapsed_s)


if __name__ == "__main__":
    main()
