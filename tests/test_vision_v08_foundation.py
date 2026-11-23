"""
VISION — MADE BY LOKESH | v0.8 Foundation Pipeline Regression Suite (`tests/test_vision_v08_foundation.py`)
Tests:
  1. Versioned Byte-Level BPE tokenizer (100% lossless round-trips + legacy compat).
  2. License allowlist, PII redaction, quality scoring, MinHash-LSH + SHA-256 dedup, template-family isolation & contamination audit.
  3. Model architecture v0.8 52M preset (~52.18M LM / ~56.08M total params), SDPA equivalence, cancellation, and CPU guardrail + 2-step smoke forward/backward.
  4. Memmap `.bin` streaming shards, resource estimator, deterministic interrupt & checkpoint resumption (optimizers/scheduler/RNG/cursors), early stopping.
  5. Honest native generated-answer evaluator across all 10 domains + WinRT isolation.
  6. Persistent `ml_foundation/worker.py` HTTP server: health, warm latency vs cold spawn, queueing, cooperative cancellation, clean shutdown.
"""

from __future__ import annotations

import http.client
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest

import torch

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.dataset_builder import (
    ALLOWED_LICENSES,
    build_unified_datasets,
    compute_quality_score,
    sanitize_and_filter_text,
    verify_zero_contamination,
)
from ml_foundation.evaluator import _verify_java_code, _verify_javascript_code, evaluate_checkpoint
from ml_foundation.local_ladder import (
    audit_local_hardware,
    prepare_bounded_local_dataset,
    run_progressive_local_ladder,
    select_local_training_ladder,
)
from ml_foundation.model import (
    JarvisConfig,
    JarvisUnifiedTransformer,
    MODEL_SCALE_PRESETS,
)
from ml_foundation.readiness_planner import (
    StreamingCorpusIngestor,
    build_dataset_catalog_manifest,
    build_gpu_training_readiness_plan,
)
from ml_foundation.corpus_curator import _CanaryDedupFilter, check_storage_budget
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.trainer import (
    StreamingMemmapBatcher,
    StreamingSFTMemmapBatcher,
    _select_amp_dtype,
    estimate_training_resources,
    run_training_pipeline,
    write_token_shards,
)


class TestTokenizerV08(unittest.TestCase):
    CODE_JSON_UNICODE_CORPUS = [
        "binary_search compute_robotic_joint_torque __init__ __name__ _private_var __all__",
        'def foo_bar(a_1: int, b_2: float = 0.5) -> dict:\n    return {"snake_case": a_1 + b_2}',
        "const openApp = async ({ app_name, retry_count = 3 }) => `\\n\\t${app_name}`;",
        "#include <vector>\nstd::vector<int> compute_dls_ik(const double* j_mat) { return {1, 2}; }",
        '{"tool": "stage_whatsapp_message", "args": {"recipient_name": "Lokesh Upadhyay", "message_text": "Hii"}}',
        r"D:\Jarvis\ml_foundation\tokenizer.py /usr/local/bin/jarvis_v0.8 ../tests/test_v08.py",
        "नमस्ते लोकेश, आज रोबोटिक्स टॉर्क और प्रोग्रामिंग की गणना करें।",
        "Bhai WhatsApp khol aur Lokesh Upadhyay ko Hii bhej de please!",
        "Symbols & Emoji: τ = m * g * r * SF ≥ 10.30 N·m 🚀⚙️🧠",
        "<bos><user>Solve x_1 + y_2 = 5</user><assistant><|tool_call|>calc</|tool_call|><eos>",
    ]

    def test_v2_tokenizer_100pct_exact_roundtrip(self) -> None:
        tok = JarvisBPE(pretokenize_mode="byte_bpe_v2")
        stats = tok.train(self.CODE_JSON_UNICODE_CORPUS * 4, target_vocab_size=1200, min_frequency=2)
        self.assertEqual(stats["pretokenize_mode"], "byte_bpe_v2")
        self.assertEqual(stats["format_version"], "2.0.0")
        res = tok.verify_roundtrip(self.CODE_JSON_UNICODE_CORPUS)
        self.assertTrue(res["passed"], f"Roundtrip failures: {res['failures']}")

        ids = tok.encode("binary_search", add_bos=False, add_eos=False)
        decoded = tok.decode(ids, skip_special_tokens=False)
        self.assertEqual(decoded, "binary_search")

        with tempfile.TemporaryDirectory() as tmpdir:
            tok.save(tmpdir)
            reloaded = JarvisBPE.load(tmpdir)
            res2 = reloaded.verify_roundtrip(self.CODE_JSON_UNICODE_CORPUS)
            self.assertTrue(res2["passed"], f"Reload roundtrip failures: {res2['failures']}")

    def test_historical_checkpoints_remain_readable(self) -> None:
        for ver, expected_mode in (("jarvis-v0.6.0", "legacy"), ("jarvis-v0.7.0", "gpt2_space")):
            ckpt_dir = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", ver)
            if os.path.isdir(ckpt_dir):
                tok = JarvisBPE.load(ckpt_dir)
                self.assertEqual(tok.pretokenize_mode, expected_mode)
                out = tok.decode(tok.encode("Hello JARVIS"))
                self.assertIn("Hello", out)


class TestDatasetBuilderV08(unittest.TestCase):
    def test_pii_quality_and_contamination_detection(self) -> None:
        raw = r"Contact admin@example.com or +91 98765 43210 at C:\Users\upadh\secret.txt with sk-1234567890abcdefghijklmnop and AKIAIOSFODNN7EXAMPLE"
        clean, keep, redactions, q = sanitize_and_filter_text(raw)
        self.assertTrue(keep)
        self.assertGreaterEqual(redactions, 4)
        self.assertNotIn("upadh", clean)
        self.assertNotIn("sk-1234567890", clean)
        self.assertNotIn("AKIAIOSFODNN7EXAMPLE", clean)
        self.assertNotIn("98765 43210", clean)
        self.assertNotIn("admin@example.com", clean)

        spam = " ".join(["repeat"] * 30)
        self.assertLess(compute_quality_score(spam), 0.5)

        train_rows = [{"instruction": "Solve 2 + 2 * 3 in decimal arithmetic step by step.", "template_family": "train_arith"}]
        dirty_eval = [
            {"instruction": "Solve 2 + 2 * 3 in decimal arithmetic step by step.", "template_family": "eval_other"},
            {"instruction": "Different arithmetic sentence with leaked template fam.", "template_family": "train_arith"},
            {"instruction": "Unseen physics question about pendulum frequency in Hz.", "template_family": "eval_phys"},
        ]
        audit = verify_zero_contamination(train_rows, dirty_eval)
        self.assertFalse(audit["zero_exact_contamination"])
        self.assertFalse(audit["zero_template_family_contamination"])
        self.assertEqual(len(audit["clean_eval_rows"]), 1)

    def test_build_unified_datasets_zero_leakage(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            manifest = build_unified_datasets(REPO_ROOT, tmpdir, vision_per_class=4, audio_per_class=4)
            audit = manifest["data_processing_audit"]
            self.assertTrue(audit["deduplicated"])
            self.assertTrue(audit["minhash_lsh_enabled"])
            self.assertTrue(audit["zero_exact_contamination_val"])
            self.assertTrue(audit["zero_exact_contamination_test"])
            self.assertTrue(audit["zero_template_family_contamination_val"])
            self.assertTrue(audit["zero_template_family_contamination_test"])
            self.assertTrue(audit["zero_minhash_contamination_val"])
            self.assertTrue(audit["zero_minhash_contamination_test"])
            self.assertTrue(audit["zero_canary_contamination"])
            self.assertTrue(audit["zero_dpo_eval_overlap"])
            for lic in manifest["license_counts"]:
                self.assertIn(lic, ALLOWED_LICENSES)
            self.assertTrue(os.path.exists(manifest["paths"]["dpo_eval"]))


class TestModelArchitectureAndSDPAV08(unittest.TestCase):
    def test_v08_52m_preset_exact_params_and_plan(self) -> None:
        preset = MODEL_SCALE_PRESETS["jarvis-v0.8-research-52m"]
        cfg = JarvisConfig(model_name="jarvis-v0.8-research-52m", vocab_size=32768, audio_feature_dim=32, **preset)
        cfg.validate()
        with torch.device("meta"):
            meta_model = JarvisUnifiedTransformer(cfg)
        counts = meta_model.parameter_count()
        self.assertEqual(counts["language_parameters"], 52_179_456)
        self.assertEqual(counts["vision_parameters"], 3_587_148)
        self.assertEqual(counts["audio_parameters"], 315_398)
        self.assertEqual(counts["total_parameters"], 56_082_002)

        plan = estimate_training_resources("jarvis-v0.8-research-52m", vocab_size=32768)
        self.assertEqual(plan["parameters"]["total_parameters"], 56_082_002)
        self.assertIn("rtx_4090_single", plan["time_and_cost_estimates"])
        self.assertIn("local_cpu_host", plan["time_and_cost_estimates"])
        self.assertGreater(plan["time_and_cost_estimates"]["local_cpu_host"]["est_hours_for_target_tokens"], 20.0)

    def test_sdpa_matches_manual_attention_and_cancel_hook(self) -> None:
        torch.manual_seed(7)
        cfg_sdpa = JarvisConfig(
            vocab_size=256, d_model=64, n_layers=2, n_heads=4, n_kv_heads=2, d_ff=128,
            max_seq_len=64, vision_dim=32, vision_layers=1, image_size=32, patch_size=8, use_sdpa=True,
        )
        cfg_manual = JarvisConfig.from_dict({**cfg_sdpa.to_dict(), "use_sdpa": False})
        m1 = JarvisUnifiedTransformer(cfg_sdpa).eval()
        m2 = JarvisUnifiedTransformer(cfg_manual).eval()
        m2.load_state_dict(m1.state_dict(), strict=True)

        x = torch.randint(0, 256, (2, 16))
        with torch.no_grad():
            o1 = m1(x)["logits"]
            o2 = m2(x)["logits"]
        max_diff = float((o1 - o2).abs().max().item())
        self.assertLess(max_diff, 1e-4)

        steps_seen = {"n": 0}

        def _cancel_after_2() -> bool:
            steps_seen["n"] += 1
            return steps_seen["n"] > 2

        out_ids = m1.generate(x[:1, :4], max_new_tokens=16, temperature=0.0, cancel_check=_cancel_after_2)
        self.assertLessEqual(len(out_ids), 4 + 3)

    def test_52m_cpu_guardrail_and_2step_smoke(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            blocked = run_training_pipeline(
                tmpdir,
                version_tag="guardrail-check",
                preset="jarvis-v0.8-research-52m",
                vocab_size=512,
                allow_large_cpu=False,
            )
            self.assertFalse(blocked["success"])
            self.assertTrue(blocked["blocked_by_cpu_guardrail"])

        # 2-step smoke forward/backward verifying real 52M preset executes without shape/memory crash
        preset = MODEL_SCALE_PRESETS["jarvis-v0.8-research-52m"]
        cfg = JarvisConfig(model_name="jarvis-v0.8-research-52m", vocab_size=512, audio_feature_dim=32, **preset)
        model = JarvisUnifiedTransformer(cfg)
        opt = torch.optim.AdamW(model.parameters(), lr=1e-4)
        inp = torch.randint(0, 512, (1, 16))
        for _ in range(2):
            opt.zero_grad()
            out = model(inp, labels=inp.clone())
            out["loss"].backward()
            opt.step()
        self.assertTrue(torch.isfinite(out["loss"]).item())


class TestTrainingPipelineV08(unittest.TestCase):
    def test_memmap_shards_and_deterministic_resume(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            docs = [[10 + (i + j) % 90 for j in range(24)] for i in range(6)]
            meta = write_token_shards(docs, tmpdir, prefix="unit")
            self.assertTrue(os.path.exists(meta["bin_path"]))
            self.assertEqual(meta["total_tokens"], 144)

            b0 = StreamingMemmapBatcher(meta["bin_path"], meta["total_tokens"], seq_len=32, rank=0, world_size=2)
            b1 = StreamingMemmapBatcher(meta["bin_path"], meta["total_tokens"], seq_len=32, rank=1, world_size=2)
            x0, _, cur0 = b0.next_batch(0, 2, pad_id=0)
            x1, _, _ = b1.next_batch(0, 2, pad_id=0)
            b0.close()
            b1.close()
            self.assertEqual(cur0, 2)
            self.assertFalse(torch.equal(x0, x1))

            # Build shared dataset once inside tmpdir so uninterrupted & resumed runs read identical data shards
            shared_ds = os.path.join(tmpdir, "shared_ds")
            build_unified_datasets(REPO_ROOT, shared_ds, vision_per_class=4, audio_per_class=4)

            full_res = run_training_pipeline(
                tmpdir,
                version_tag="run-full",
                preset="jarvis-micro-multimodal",
                vocab_size=600,
                pretrain_steps=4,
                sft_steps=4,
                vision_steps=0,
                dpo_steps=0,
                grad_accum_steps=1,
                seed=123,
                early_stopping=False,
                dataset_override_dir=shared_ds,
            )
            self.assertTrue(full_res["success"])

            part1 = run_training_pipeline(
                tmpdir,
                version_tag="run-resume",
                preset="jarvis-micro-multimodal",
                vocab_size=600,
                pretrain_steps=4,
                sft_steps=4,
                vision_steps=0,
                dpo_steps=0,
                grad_accum_steps=1,
                seed=123,
                early_stopping=False,
                stop_after_stage="stage1_pretrain",
                stop_after_step=2,
                dataset_override_dir=shared_ds,
            )
            self.assertTrue(part1["success"])
            part1_ckpt = part1["artifacts"]["checkpoint_dir"]

            part2 = run_training_pipeline(
                tmpdir,
                version_tag="run-resume",
                preset="jarvis-micro-multimodal",
                vocab_size=600,
                pretrain_steps=4,
                sft_steps=4,
                vision_steps=0,
                dpo_steps=0,
                grad_accum_steps=1,
                resume_from=part1_ckpt,
                seed=123,
                early_stopping=False,
                dataset_override_dir=shared_ds,
            )
            self.assertTrue(part2["success"])
            self.assertTrue(part2["training_config"]["resumed_full_training_state"])
            self.assertEqual(full_res["training_metrics"]["sft_val_loss"], part2["training_metrics"]["sft_val_loss"])
            self.assertEqual(full_res["loss_curves"]["stage1_pretrain"], part2["loss_curves"]["stage1_pretrain"])
            self.assertEqual(full_res["loss_curves"]["stage2_sft"], part2["loss_curves"]["stage2_sft"])
            w_full = torch.load(full_res["artifacts"]["weights_path"], map_location="cpu", weights_only=True)["model_state_dict"]
            w_res = torch.load(part2["artifacts"]["weights_path"], map_location="cpu", weights_only=True)["model_state_dict"]
            self.assertEqual(set(w_full.keys()), set(w_res.keys()))
            for k in w_full:
                self.assertTrue(torch.equal(w_full[k], w_res[k]), f"Tensor mismatch after resume for {k}")


class TestEvaluatorAndWorkerV08(unittest.TestCase):
    def test_evaluator_honest_generation_mode(self) -> None:
        v07_dir = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "jarvis-v0.7.0")
        if not os.path.isdir(v07_dir):
            self.skipTest("jarvis-v0.7.0 checkpoint not present")
        ev = evaluate_checkpoint(REPO_ROOT, v07_dir)
        self.assertTrue(ev["success"])
        self.assertEqual(ev["evaluation_mode"], "NATIVE_GENERATION_ONLY_NO_GEMINI_NO_RAG_NO_TOOLS")
        self.assertEqual(ev["metrics"]["ocr_backend"], "external_winrt_sensor_non_neural")
        self.assertFalse(ev["production_primary_eligible"])
        self.assertGreaterEqual(len(ev["per_example_results"]), 18)
        self.assertIn("unseen_external_perplexity", ev["metrics"])
        for dom in (
            "language_generation", "mathematics", "coding", "coding_python", "coding_javascript",
            "instruction_following", "multistep_reasoning", "general_knowledge",
            "engineering_knowledge", "tool_selection", "tool_argument_validity",
            "visual_understanding", "audio_understanding",
        ):
            self.assertIn(dom, ev["metrics"]["domain_benchmarks"])

    def test_persistent_worker_warm_latency_queue_and_cancel(self) -> None:
        v07_dir = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "jarvis-v0.7.0")
        if not os.path.isdir(v07_dir):
            self.skipTest("jarvis-v0.7.0 checkpoint not present")

        worker_script = os.path.join(REPO_ROOT, "ml_foundation", "worker.py")
        proc = subprocess.Popen(
            [sys.executable, worker_script, "--checkpoint-dir", v07_dir, "--max-queue-size", "8"],
            cwd=REPO_ROOT,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            ready_line = ""
            deadline = time.time() + 20.0
            while time.time() < deadline:
                line = proc.stdout.readline().strip()
                if line.startswith("WORKER_READY "):
                    ready_line = line
                    break
            self.assertTrue(ready_line, "Worker did not emit WORKER_READY banner")
            info = json.loads(ready_line[len("WORKER_READY "):])
            port = int(info["port"])

            def _req(method: str, path: str, body: dict | None = None):
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
                payload = json.dumps(body).encode("utf-8") if body is not None else None
                headers = {"Content-Type": "application/json"} if payload else {}
                conn.request(method, path, body=payload, headers=headers)
                resp = conn.getresponse()
                data = json.loads(resp.read().decode("utf-8"))
                conn.close()
                return resp.status, data

            st, health = _req("GET", "/health")
            self.assertEqual(st, 200)
            self.assertTrue(health["ok"])
            self.assertTrue(health["loaded"])
            self.assertGreater(health["rss_mb"], 0)

            # Warm requests sequentially
            latencies = []
            for idx in range(2):
                st_i, res_i = _req("POST", "/infer", {"request_id": f"warm-{idx}", "prompt": "Who are you?", "max_tokens": 12})
                self.assertEqual(st_i, 200)
                self.assertTrue(res_i["success"])
                self.assertTrue(res_i["warm_worker"])
                latencies.append(float(res_i["latency_ms"]))
            self.assertLess(max(latencies), 1500.0)

            # Concurrent queue + cancel second queued item
            results = {}

            def _call(rid: str, max_toks: int):
                results[rid] = _req("POST", "/infer", {"request_id": rid, "prompt": "Explain PID control", "max_tokens": max_toks})

            t1 = threading.Thread(target=_call, args=("q-1", 48))
            t2 = threading.Thread(target=_call, args=("q-2", 48))
            t1.start()
            time.sleep(0.02)
            t2.start()
            time.sleep(0.03)
            st_c, res_c = _req("POST", "/cancel", {"request_id": "q-2"})
            self.assertEqual(st_c, 200)
            self.assertTrue(res_c["cancelled"])
            t1.join(timeout=15)
            t2.join(timeout=15)

            self.assertEqual(results["q-1"][0], 200)
            self.assertTrue(results["q-1"][1]["success"])
            self.assertTrue(results["q-2"][1]["cancelled"])

            st_s, _ = _req("POST", "/shutdown", {})
            self.assertEqual(st_s, 200)
            proc.wait(timeout=10)
            self.assertEqual(proc.returncode, 0)
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait(timeout=5)
            for stream in (proc.stdin, proc.stdout, proc.stderr):
                if stream is not None:
                    try:
                        stream.close()
                    except Exception:
                        pass


class TestReadinessAndStreamingV08(unittest.TestCase):
    def test_dataset_catalog_licenses_and_token_totals(self) -> None:
        cat = build_dataset_catalog_manifest()
        self.assertTrue(cat["all_registered_licenses_verified"])
        totals = cat["token_totals"]
        self.assertEqual(totals["stage1_pretrain_full_tokens"], 2_087_178_240)
        self.assertTrue(totals["full_target_matches_40x_overtrain"])
        self.assertEqual(totals["stage2_sft_full_tokens"], 80_000_000)
        self.assertEqual(totals["combined_pilot_tokens"], 55_000_000)
        self.assertEqual(
            set(cat["origin_separation_tokens"]["full_run"].keys()),
            {"public", "synthetic", "curated", "proprietary"},
        )
        excluded_ids = {d["id"] for d in cat["excluded_and_sealed_datasets"]}
        self.assertIn("open_web_math", excluded_ids)
        self.assertIn("sealed_eval_benchmarks", excluded_ids)

    def test_streaming_corpus_ingestor_dedup_license_and_isolation(self) -> None:
        tok = JarvisBPE(pretokenize_mode="byte_bpe_v2")
        tok.train(
            [
                "Inverse kinematics damped least squares computes robotic joint velocities safely.",
                "Python function compute_torque returns Newton meters from force and lever arm.",
                "नमस्ते रोबोटिक्स इंजीनियरिंग और गणितीय विश्लेषण।",
            ]
            * 4,
            target_vocab_size=900,
            min_frequency=2,
        )

        # Build a lazy generator stream across origins + deliberate violations (unclear license, canary, exact/near dup, PII)
        records = [
            {
                "text": "Inverse kinematics damped least squares avoids singular joint configurations cleanly.",
                "license": "ODC-By-1.0",
                "origin_class": "public",
                "domain": "robotics",
                "template_family": "pub_ik_1",
            },
            {
                "text": "Inverse kinematics damped least squares avoids singular joint configurations cleanly.",  # exact dup
                "license": "ODC-By-1.0",
                "origin_class": "public",
                "domain": "robotics",
                "template_family": "pub_ik_dup",
            },
            {
                "text": "Inverse kinematics damped least squares avoids singular joint configurations carefully.",  # MinHash near dup
                "license": "ODC-By-1.0",
                "origin_class": "public",
                "domain": "robotics",
                "template_family": "pub_ik_neardup",
            },
            {
                "text": "Unclear license scraped blog article that must be dropped strictly.",
                "license": "UNKNOWN",
                "origin_class": "public",
                "domain": "language",
                "template_family": "bad_lic",
            },
            {
                "text": "Natalia sold clips to 48 of her friends in April and then sold half as many in May.",  # GSM8K canary
                "license": "MIT",
                "origin_class": "curated",
                "domain": "mathematics",
                "template_family": "canary_leak",
            },
            {
                "text": r"Contact dev@example.org at C:\Users\upadh\keys.txt with sk-abcdefghijklmnopqrstuvwxyz12345 for setup notes.",
                "license": "Apache-2.0",
                "origin_class": "synthetic",
                "domain": "coding",
                "template_family": "syn_pii_clean",
            },
            {
                "text": "Proprietary JARVIS verified episode for 6-DOF arm joint torque clamping under Emergency Stop.",
                "license": "Original-Curated",
                "origin_class": "proprietary",
                "domain": "robotics",
                "template_family": "prop_jarvis_1",
            },
        ]
        # Add distinct template_family docs so all splits receive distinct non-empty coverage cleanly
        for i in range(60):
            records.append(
                {
                    "text": f"Engineering module {i}: gear reduction ratio {i + 2}:1 delivers reliable actuation torque step {i * 3}.",
                    "license": "CC-BY-4.0",
                    "origin_class": "curated",
                    "domain": "engineering",
                    "template_family": f"eng_fam_{i}",
                }
            )

        with tempfile.TemporaryDirectory() as tmpdir:
            ingestor = StreamingCorpusIngestor(tok, tmpdir, min_quality=0.45, near_dup_threshold=0.72)
            rep = ingestor.ingest_stream(iter(records))
            st = rep["stats"]
            self.assertEqual(st["rejected_missing_or_unclear_license"], 1)
            self.assertEqual(st["contamination_canary_removed"], 1)
            self.assertEqual(st["dedup_exact_removed"], 1)
            self.assertGreaterEqual(st["dedup_minhash_removed"], 1)
            self.assertGreaterEqual(st["pii_redactions_applied"], 2)

            audit = rep["isolation_audit"]
            self.assertTrue(audit["zero_template_family_overlap_train_val"])
            self.assertTrue(audit["zero_template_family_overlap_train_test"])
            self.assertTrue(audit["zero_exact_contamination_val"])
            self.assertTrue(audit["zero_exact_contamination_test"])
            self.assertTrue(audit["zero_canary_contamination"])

            train_shard = rep["shards"]["train"]
            self.assertTrue(os.path.exists(train_shard["bin_path"]))
            batcher = StreamingMemmapBatcher(train_shard["bin_path"], train_shard["tokens"], seq_len=16)
            bx, _, _ = batcher.next_batch(0, 2, pad_id=tok.pad_id)
            batcher.close()
            self.assertEqual(bx.shape, (2, 16))

    def test_gpu_readiness_plan_and_js_verifier(self) -> None:
        plan = build_gpu_training_readiness_plan()
        self.assertTrue(plan["config_internally_consistent"])
        self.assertEqual(plan["parameters"]["total_parameters"], 56_082_002)
        self.assertGreater(plan["usd_to_inr_rate"], 80.0)
        self.assertGreaterEqual(len(plan["gpu_recommendations"]), 5)
        for gpu in plan["gpu_recommendations"]:
            self.assertIn("full_est_cost_usd", gpu)
            self.assertIn("full_est_cost_inr", gpu)
            self.assertIn("pilot_est_cost_usd", gpu)
            self.assertIn("pilot_est_cost_inr", gpu)
            self.assertTrue(gpu["fits_in_vram"])

        ok_js, err_js = _verify_javascript_code(
            "```js\nfunction multiplyTwo(a, b) { return a * b; }\n```",
            "multiplyTwo",
            "if (multiplyTwo(6, 7) !== 42) throw new Error('bad');",
        )
        self.assertTrue(ok_js, err_js)
        bad_js, _ = _verify_javascript_code(
            "function multiplyTwo(a, b) { return a + b; }",
            "multiplyTwo",
            "if (multiplyTwo(6, 7) !== 42) throw new Error('bad');",
        )
        self.assertFalse(bad_js)


class TestLocalScalingOptimizationV08(unittest.TestCase):
    def test_cpu_amp_avoids_slow_emulated_bf16_and_grad_ckpt_matches(self) -> None:
        self.assertEqual(_select_amp_dtype("auto", torch.device("cpu")), (None, False))

        torch.manual_seed(11)
        base_kw = dict(
            vocab_size=256, d_model=64, n_layers=2, n_heads=4, n_kv_heads=2, d_ff=128,
            max_seq_len=64, vision_dim=32, vision_layers=1, image_size=32, patch_size=8,
        )
        m_std = JarvisUnifiedTransformer(JarvisConfig(gradient_checkpointing=False, **base_kw))
        m_gc = JarvisUnifiedTransformer(JarvisConfig(gradient_checkpointing=True, **base_kw))
        m_gc.load_state_dict(m_std.state_dict(), strict=True)
        m_std.train()
        m_gc.train()

        x = torch.randint(0, 256, (2, 16))
        torch.manual_seed(99)
        l1 = m_std(x, labels=x)["loss"]
        l1.backward()
        torch.manual_seed(99)
        l2 = m_gc(x, labels=x)["loss"]
        l2.backward()
        self.assertLess(abs(float(l1.item()) - float(l2.item())), 1e-6)
        max_g_diff = max(
            float((p1.grad - p2.grad).abs().max().item())
            for p1, p2 in zip(m_std.parameters(), m_gc.parameters())
            if p1.grad is not None and p2.grad is not None
        )
        self.assertLess(max_g_diff, 1e-5)

        for pname in ("jarvis-local-10m", "jarvis-local-25m"):
            self.assertIn(pname, MODEL_SCALE_PRESETS)

    def test_adafactor_cancel_flag_external_shard_and_java_probe(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            shared_ds = os.path.join(tmpdir, "cached_ds")
            prep = prepare_bounded_local_dataset(REPO_ROOT, shared_ds, tokenizer_vocab_size=1200)
            self.assertGreater(prep["exact_token_counts"]["total_local_tokens"], 2000)
            self.assertIn("programming_java", prep["domain_counts"])
            self.assertIn("software_engineering", prep["domain_counts"])

            cancel_file = os.path.join(tmpdir, "cancel.flag")
            with open(cancel_file, "w", encoding="utf-8") as cf:
                cf.write("stop")

            res_abort = run_training_pipeline(
                tmpdir,
                version_tag="abort-test",
                preset="jarvis-nano-multimodal",
                vocab_size=600,
                pretrain_steps=4,
                sft_steps=2,
                vision_steps=0,
                dpo_steps=0,
                optimizer_type="adafactor",
                gradient_checkpointing=True,
                threads=4,
                seq_len=64,
                micro_batch_size=1,
                cancel_flag_path=cancel_file,
                low_ram_mode=True,
                dataset_override_dir=shared_ds,
            )
            self.assertTrue(res_abort["success"])
            self.assertEqual(res_abort["training_config"]["optimizer_type"], "adafactor")
            self.assertEqual(res_abort["training_config"]["aborted_reason"], "CANCEL_FLAG_DETECTED")
            self.assertTrue(res_abort["training_config"]["dataset_cached"])

        ok_java, err_java = _verify_java_code(
            "```java\npublic static int maxOfTwo(int a, int b) { return a >= b ? a : b; }\n```",
            "maxOfTwo",
            ("int a", "int b"),
        )
        self.assertTrue(ok_java, err_java)

    def test_local_hardware_audit_and_smoke_ladder(self) -> None:
        hw = audit_local_hardware(REPO_ROOT)
        self.assertEqual(hw["recommended_cpu_dtype"], "fp32")
        sel = select_local_training_ladder(hw, repo_root=REPO_ROOT)
        tier_names = {t["tier"] for t in sel["selected_tiers"]}
        self.assertIn("smoke", tier_names)

        with tempfile.TemporaryDirectory() as tmpdir:
            shared_ds = os.path.join(tmpdir, "shared_ds")
            os.makedirs(os.path.join(tmpdir, "data", "neural_models", "checkpoints"), exist_ok=True)
            lad = run_progressive_local_ladder(
                tmpdir,
                run_tag="ut",
                tiers=("smoke",),
                steps_scale=0.15,
                max_total_minutes=5.0,
                threads=4,
                dataset_dir=shared_ds,
            )
            self.assertTrue(lad["success"])
            self.assertFalse(lad["production_primary_replaced"])
            self.assertEqual(len(lad["tiers_executed"]), 1)
            ev_m = lad["tiers_executed"][0]["evaluation"]["metrics"]["domain_benchmarks"]
            for dom in ("coding_java", "software_engineering", "hindi_devanagari"):
                self.assertIn(dom, ev_m)

    def test_corpus_curator_dedup_and_streaming_sft_memmap(self) -> None:
        import numpy as np

        budget = check_storage_budget(REPO_ROOT, planned_add_gb=0.0, min_free_d_gb=0.1, min_free_c_gb=0.1)
        self.assertIn("c_free_gb", budget)
        self.assertIn("d_free_gb", budget)
        self.assertTrue(budget["safe"])

        filt = _CanaryDedupFilter(near_dup_threshold=0.75)
        self.assertEqual(filt.accept("Write a python function add_two(a, b) returning a + b please")[1], "canary")
        ok1, r1 = filt.accept("Newton second law relates force equals mass times acceleration in classical mechanics.", check_near_dup=True)
        self.assertTrue(ok1, r1)
        ok_dup, r_dup = filt.accept("Newton second law relates force equals mass times acceleration in classical mechanics.", check_near_dup=True)
        self.assertFalse(ok_dup)
        self.assertEqual(r_dup, "exact_dup")

        with tempfile.TemporaryDirectory() as tmpdir:
            shard_dir = os.path.join(tmpdir, "ext_shards")
            os.makedirs(shard_dir, exist_ok=True)
            tok = JarvisBPE(pretokenize_mode="byte_bpe_v2")
            tok.train(["def add(a, b): return a + b", "<user>hi</user><assistant>hello there<eos>"], target_vocab_size=360, min_frequency=1)
            tok.save(shard_dir)

            pre = np.arange(10, 10 + 1024, dtype=np.uint32) % 300 + 8
            pre_bin = os.path.join(shard_dir, "pretrain_tokens.bin")
            pre.tofile(pre_bin)
            with open(os.path.join(shard_dir, "pretrain_meta.json"), "w", encoding="utf-8") as pmf:
                json.dump({"prefix": "pretrain", "dtype": "uint32", "total_tokens": int(pre.size), "bin_path": pre_bin}, pmf)

            block_size = 32
            n_blocks = 8
            inp = np.full((n_blocks, block_size), 12, dtype=np.uint32)
            lbl = np.full((n_blocks, block_size), -100, dtype=np.int32)
            lbl[:, 12:] = 15
            inp.tofile(os.path.join(shard_dir, "sft_train_inp.bin"))
            lbl.tofile(os.path.join(shard_dir, "sft_train_lbl.bin"))
            inp[:2].tofile(os.path.join(shard_dir, "sft_val_inp.bin"))
            lbl[:2].tofile(os.path.join(shard_dir, "sft_val_lbl.bin"))
            with open(os.path.join(shard_dir, "sft_meta.json"), "w", encoding="utf-8") as smf:
                json.dump({"block_size": block_size, "train_blocks": n_blocks, "train_tokens": n_blocks * block_size, "val_blocks": 2, "val_tokens": 2 * block_size}, smf)

            sb = StreamingSFTMemmapBatcher(os.path.join(shard_dir, "sft_train_inp.bin"), os.path.join(shard_dir, "sft_train_lbl.bin"), block_size=block_size, num_blocks=n_blocks)
            try:
                bx, by, cur = sb.next_batch(0, 2, max_seq_len=32)
                self.assertEqual(tuple(bx.shape), (2, 32))
                self.assertEqual(tuple(by.shape), (2, 32))
                self.assertTrue((by[:, :12] == -100).all().item())
                self.assertEqual(cur, 2)
            finally:
                sb.close()

            ds_dir = os.path.join(tmpdir, "local_ds")
            build_unified_datasets(tmpdir, ds_dir, vision_per_class=4, audio_per_class=4, image_size=32)
            res = run_training_pipeline(
                tmpdir,
                version_tag="ext-shard-test",
                preset="jarvis-micro-multimodal",
                vocab_size=360,
                pretrain_steps=2,
                sft_steps=2,
                vision_steps=0,
                dpo_steps=0,
                grad_accum_steps=1,
                early_stopping=False,
                dataset_override_dir=ds_dir,
                external_shard_dir=shard_dir,
                seq_len=32,
                micro_batch_size=2,
                allow_large_cpu=True,
            )
            self.assertTrue(res["success"])
            self.assertEqual(res["dataset_tokens"]["pretrain_tokens"], 1024)
            self.assertEqual(res["dataset_tokens"]["sft_train_tokens"], n_blocks * block_size)
            self.assertEqual(res["tokenizer"]["vocab_size"], tok.vocab_size)


class TestBalancedFoundationV10(unittest.TestCase):
    def test_compact_tool_schema_and_refusal_filtering(self):
        from ml_foundation.corpus_curator import EVAL_PROBE_CANARIES, _compact_tool_sys, _parse_glaive_or_hermes_tool

        self.assertTrue(any("derivative (d)" in c for c in EVAL_PROBE_CANARIES))
        self.assertTrue(any("6-dof robotic actuator" in c for c in EVAL_PROBE_CANARIES))

        long_sys = (
            'You are a function calling AI model. <tools>{"name": "open_weather", "description": "big '
            + ("x" * 600)
            + '"} {"name": "set_alarm", "parameters": {}}</tools>'
        )
        compact = _compact_tool_sys(long_sys)
        self.assertEqual(compact, "Available tools: [open_weather, set_alarm]")

        hermes_tool = _parse_glaive_or_hermes_tool(
            long_sys,
            [
                {"from": "system", "value": long_sys},
                {"from": "human", "value": "Check weather for Pune today please."},
                {"from": "gpt", "value": '<tool_call>{"name": "open_weather", "arguments": {"city": "Pune"}}</tool_call>'},
            ],
        )
        self.assertIsNotNone(hermes_tool)
        self.assertIn("Available tools: [open_weather, set_alarm]", hermes_tool[0])
        self.assertIn('<|tool_call|>{"tool": "open_weather"', hermes_tool[1])

        refusal = _parse_glaive_or_hermes_tool(
            "SYSTEM: You are a helpful assistant, with no access to external functions.",
            "USER: Book me a ticket to Mumbai right now\nASSISTANT: I'm sorry, I don't have access to external functions.",
        )
        self.assertIsNone(refusal)

    def test_strict_evaluator_rejects_bleed_and_checks_domains(self):
        from ml_foundation.evaluator import _verify_language_coherence

        self.assertFalse(_verify_language_coherence("Audio classicine verified systems", required_any=("verified",))[0])
        self.assertFalse(_verify_language_coherence("de la validation split zaroori hai", required_any=("val", "split"))[0])
        self.assertFalse(_verify_language_coherence("```python\ndef x(): pass\n```", required_any=("overshoot", "damp"))[0])
        self.assertTrue(_verify_language_coherence("Derivative (D) control reduces overshoot and damps joint oscillation safely.", required_any=("overshoot", "damp"))[0])
        self.assertFalse(_verify_java_code("public static int maxOfTwo(int a, int b) { return a; }", "maxOfTwo", (">",))[0])
        self.assertTrue(_verify_java_code("public static int maxOfTwo(int a, int b) { return a > b ? a : b; }", "maxOfTwo", (">",))[0])

    def test_multistage_shard_prefix_and_completed_stage_lr_reset(self):
        import numpy as np
        from ml_foundation.tokenizer import JarvisBPE
        from ml_foundation.trainer import run_training_pipeline

        with tempfile.TemporaryDirectory() as tmpdir:
            shard_dir = os.path.join(tmpdir, "shards")
            os.makedirs(shard_dir, exist_ok=True)
            tok = JarvisBPE(pretokenize_mode="byte_bpe_v2")
            tok.train(["<user>hi</user><assistant>hello there robotics engineer</assistant>" for _ in range(12)], target_vocab_size=360)
            tok.save(shard_dir)

            pre_ids = np.asarray((tok.encode("PID controller damps joint overshoot cleanly.", add_bos=True, add_eos=True) * 20)[:512], dtype=np.uint32)
            pre_ids.tofile(os.path.join(shard_dir, "pretrain_tokens.bin"))
            with open(os.path.join(shard_dir, "pretrain_meta.json"), "w", encoding="utf-8") as mf:
                json.dump({"prefix": "pretrain", "total_tokens": int(pre_ids.size)}, mf)
            pre_ids.tofile(os.path.join(shard_dir, "stage2_domain_tokens.bin"))
            with open(os.path.join(shard_dir, "stage2_domain_meta.json"), "w", encoding="utf-8") as mf:
                json.dump({"prefix": "stage2_domain", "total_tokens": int(pre_ids.size)}, mf)

            blk_w, n_b = 32, 4
            inp = np.full((n_b, blk_w), tok.pad_id, dtype=np.uint32)
            lbl = np.full((n_b, blk_w), -100, dtype=np.int32)
            seq = tok.encode("<bos><user>Compute 2+2</user><assistant>4<eos>")
            inp[:, :len(seq)] = np.asarray(seq, dtype=np.uint32)
            lbl[:, len(seq)-4:len(seq)] = np.asarray(seq[-4:], dtype=np.int32)
            for pref in ("sft_train", "stage4_math_code", "sft_val"):
                inp.tofile(os.path.join(shard_dir, f"{pref}_inp.bin"))
                lbl.tofile(os.path.join(shard_dir, f"{pref}_lbl.bin"))
            with open(os.path.join(shard_dir, "sft_meta.json"), "w", encoding="utf-8") as mf:
                json.dump({"block_size": blk_w, "train_blocks": n_b, "stage4_blocks": n_b, "val_blocks": n_b}, mf)

            ds_dir = os.path.join(tmpdir, "local_ds")
            build_unified_datasets(tmpdir, ds_dir, vision_per_class=4, audio_per_class=4, image_size=32)

            r1 = run_training_pipeline(
                tmpdir, version_tag="stage-p1", preset="jarvis-micro-multimodal", vocab_size=360,
                pretrain_steps=2, sft_steps=0, vision_steps=0, dpo_steps=0, grad_accum_steps=1,
                early_stopping=False, dataset_override_dir=ds_dir, external_shard_dir=shard_dir,
                seq_len=32, micro_batch_size=2, allow_large_cpu=True, pretrain_shard_prefix="stage2_domain",
            )
            self.assertEqual(r1["training_config"]["pretrain_shard_prefix"], "stage2_domain")

            r2 = run_training_pipeline(
                tmpdir, version_tag="stage-s4", preset="jarvis-micro-multimodal", vocab_size=360,
                pretrain_steps=0, sft_steps=2, vision_steps=0, dpo_steps=0, grad_accum_steps=1,
                resume_from=r1["artifacts"]["checkpoint_dir"],
                early_stopping=False, dataset_override_dir=ds_dir, external_shard_dir=shard_dir,
                seq_len=32, micro_batch_size=2, allow_large_cpu=True, sft_shard_prefix="stage4_math_code",
            )
            self.assertTrue(r2["success"])
            self.assertIsNotNone(r2["training_config"]["resumed_from_checkpoint"])
            self.assertFalse(r2["training_config"]["resumed_full_training_state"])
            self.assertEqual(r2["training_config"]["sft_shard_prefix"], "stage4_math_code")


class TestQualityFirstV11(unittest.TestCase):
    def test_optimizer_decay_grouping_and_multimodal_lm_freeze(self):
        from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
        from ml_foundation.trainer import _make_optimizer, run_training_pipeline

        cfg = JarvisConfig(model_name="jarvis-quality-4m", vocab_size=360, d_model=192, n_layers=6, n_heads=6, n_kv_heads=3, d_ff=512, max_seq_len=384)
        m = JarvisUnifiedTransformer(cfg)
        opt = _make_optimizer(None, lr=1e-3, weight_decay=0.02, optimizer_type="adamw", named_params=m.named_parameters())
        self.assertEqual(len(opt.param_groups), 2)
        self.assertEqual(opt.param_groups[0]["weight_decay"], 0.02)
        self.assertEqual(opt.param_groups[1]["weight_decay"], 0.0)

        with tempfile.TemporaryDirectory() as tmpdir:
            ds_dir = os.path.join(tmpdir, "local_ds")
            build_unified_datasets(tmpdir, ds_dir, vision_per_class=4, audio_per_class=4, image_size=32)
            r_pre = run_training_pipeline(
                tmpdir, version_tag="base-lm", preset="jarvis-nano-multimodal", vocab_size=360,
                pretrain_steps=2, sft_steps=2, vision_steps=0, dpo_steps=0,
                early_stopping=False, dataset_override_dir=ds_dir, seq_len=32, micro_batch_size=2,
            )
            w_before = torch.load(r_pre["artifacts"]["weights_path"], map_location="cpu", weights_only=True)["model_state_dict"]
            r_mm = run_training_pipeline(
                tmpdir, version_tag="frozen-mm", preset="jarvis-nano-multimodal", vocab_size=360,
                pretrain_steps=0, sft_steps=0, vision_steps=4, dpo_steps=0,
                resume_from=r_pre["artifacts"]["checkpoint_dir"],
                early_stopping=False, dataset_override_dir=ds_dir, seq_len=32, micro_batch_size=2,
                freeze_lm_for_multimodal=True,
            )
            w_after = torch.load(r_mm["artifacts"]["weights_path"], map_location="cpu", weights_only=True)["model_state_dict"]
            self.assertTrue(torch.equal(w_before["tok_emb.weight"], w_after["tok_emb.weight"]))
            self.assertTrue(torch.equal(w_before["blocks.0.attn.q_proj.weight"], w_after["blocks.0.attn.q_proj.weight"]))

    def test_quality_curriculum_guards_and_real_multimodal_models(self):
        from ml_foundation.quality_curriculum import _clean_gsm8k_answer, _normalize_tool_call_pair, _passes_canary_and_noise
        from ml_foundation.real_multimodal import RealAudioSpecCNN, RealVisionCNN

        self.assertFalse(_passes_canary_and_noise("Solve 4*x + 9 = 29 cleanly"))
        self.assertFalse(_passes_canary_and_noise("Malraa bahan ki text"))
        self.assertTrue(_passes_canary_and_noise("Calculate 12 * 4 = 48 cleanly."))

        cleaned = _clean_gsm8k_answer("48 / 2 = <<48/2=24>>24.\n#### 24")
        self.assertNotIn("<<", cleaned)
        self.assertIn("Answer: 24", cleaned)

        norm = _normalize_tool_call_pair("Check Pune weather", '{"name": "get_weather", "arguments": \'{"city": "Pune"}\'}')
        self.assertIsNotNone(norm)
        self.assertIn("Available tools: [", norm[0])
        self.assertIn('"tool": "get_weather"', norm[1])

        v_net = RealVisionCNN(in_channels=3, num_classes=3, base_width=16)
        self.assertEqual(tuple(v_net(torch.randn(2, 3, 64, 64)).shape), (2, 3))
        a_net = RealAudioSpecCNN(in_bins=48, num_classes=10)
        self.assertEqual(tuple(a_net(torch.randn(2, 32, 48)).shape), (2, 10))



if __name__ == "__main__":
    unittest.main(verbosity=2)
