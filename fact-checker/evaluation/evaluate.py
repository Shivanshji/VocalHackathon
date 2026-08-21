"""
Evaluation harness — runs the fact-check pipeline against hand-labelled
claims and reports accuracy metrics.

Usage:
    cd fact-checker
    python -m evaluation.evaluate

Optional flags:
    --limit N       Only evaluate the first N claims
    --verbose       Print detailed results for each claim
"""

import asyncio
import json
import sys
import time
from pathlib import Path

import httpx


DATASET_PATH = Path(__file__).parent / "dataset.json"
API_BASE_URL = "http://localhost:8000"


def load_dataset(limit: int = None) -> list:
    """Load the evaluation dataset."""
    with open(DATASET_PATH) as f:
        data = json.load(f)
    if limit:
        data = data[:limit]
    return data


async def evaluate_claim(client: httpx.AsyncClient, claim: dict) -> dict:
    """Send a claim to the fact-check API and compare with expected verdict."""
    payload = {
        "session_id": f"eval_{claim['id']}",
        "segment_id": f"seg_{claim['id']}",
        "start": 0.0,
        "end": 5.0,
        "english_text": claim["claim"],
        "should_fact_check": True,
        "statement_type": "factual_claim",
        "routing_reason": "Evaluation harness test claim.",
    }

    start_time = time.time()
    try:
        response = await client.post(
            f"{API_BASE_URL}/fact-check",
            json=payload,
            timeout=180.0,
        )
        elapsed = time.time() - start_time

        if response.status_code != 200:
            return {
                "id": claim["id"],
                "claim": claim["claim"],
                "expected": claim["expected_verdict"],
                "predicted": "ERROR",
                "correct": False,
                "confidence": 0.0,
                "elapsed": elapsed,
                "error": f"HTTP {response.status_code}: {response.text[:200]}",
            }

        result = response.json()
        predicted = result.get("verdict", "ERROR")
        expected = claim["expected_verdict"]
        correct = predicted == expected

        return {
            "id": claim["id"],
            "claim": claim["claim"],
            "expected": expected,
            "predicted": predicted,
            "correct": correct,
            "confidence": result.get("confidence", 0.0),
            "explanation": result.get("explanation", "")[:200],
            "evidence_count": len(result.get("evidence", [])),
            "elapsed": elapsed,
        }

    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "id": claim["id"],
            "claim": claim["claim"],
            "expected": claim["expected_verdict"],
            "predicted": "ERROR",
            "correct": False,
            "confidence": 0.0,
            "elapsed": elapsed,
            "error": str(e),
        }


async def run_evaluation(limit: int = None, verbose: bool = False):
    """Run the full evaluation suite."""
    dataset = load_dataset(limit)
    print(f"\n{'='*70}")
    print(f"  P3 Fact-Check Engine — Evaluation Harness")
    print(f"  Claims: {len(dataset)}")
    print(f"  API:    {API_BASE_URL}")
    print(f"{'='*70}\n")

    results = []
    async with httpx.AsyncClient() as client:
        for i, claim in enumerate(dataset):
            print(f"[{i+1}/{len(dataset)}] Evaluating: {claim['claim'][:60]}...", end=" ", flush=True)
            result = await evaluate_claim(client, claim)
            results.append(result)

            icon = "[OK]" if result["correct"] else "[FAIL]"
            print(f"{icon} {result['predicted']} (expected: {result['expected']}) [{result['elapsed']:.1f}s]")

            if verbose and not result["correct"]:
                print(f"         Explanation: {result.get('explanation', 'N/A')[:100]}")
                if "error" in result:
                    print(f"         Error: {result['error'][:100]}")

    # --- Summary ---
    total = len(results)
    correct = sum(1 for r in results if r["correct"])
    errors = sum(1 for r in results if r["predicted"] == "ERROR")
    accuracy = correct / total if total > 0 else 0

    avg_confidence = sum(r["confidence"] for r in results) / total if total > 0 else 0
    avg_time = sum(r["elapsed"] for r in results) / total if total > 0 else 0

    # Per-category breakdown
    by_expected = {}
    for r in results:
        exp = r["expected"]
        if exp not in by_expected:
            by_expected[exp] = {"total": 0, "correct": 0}
        by_expected[exp]["total"] += 1
        if r["correct"]:
            by_expected[exp]["correct"] += 1

    print(f"\n{'='*70}")
    print(f"  RESULTS")
    print(f"{'='*70}")
    print(f"  Accuracy:          {correct}/{total} ({accuracy:.1%})")
    print(f"  Errors:            {errors}/{total}")
    print(f"  Avg Confidence:    {avg_confidence:.3f}")
    print(f"  Avg Latency:       {avg_time:.1f}s per claim")
    print()

    print("  Per-verdict breakdown:")
    for verdict, stats in sorted(by_expected.items()):
        v_acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
        print(f"    {verdict:28s} {stats['correct']}/{stats['total']} ({v_acc:.1%})")

    print(f"{'='*70}\n")

    # Save results to file
    output_path = Path(__file__).parent / "results.json"
    with open(output_path, "w") as f:
        json.dump({
            "summary": {
                "total": total,
                "correct": correct,
                "accuracy": accuracy,
                "errors": errors,
                "avg_confidence": avg_confidence,
                "avg_latency_seconds": avg_time,
            },
            "per_verdict": by_expected,
            "details": results,
        }, f, indent=2)

    print(f"  Results saved to: {output_path}")
    return accuracy


if __name__ == "__main__":
    limit = None
    verbose = False

    for arg in sys.argv[1:]:
        if arg == "--verbose":
            verbose = True
        elif arg == "--limit":
            idx = sys.argv.index("--limit")
            if idx + 1 < len(sys.argv):
                limit = int(sys.argv[idx + 1])

    asyncio.run(run_evaluation(limit=limit, verbose=verbose))
