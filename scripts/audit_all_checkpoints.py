import os
import json
import torch
import hashlib

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

def main():
    ckpt_root = "data/neural_models/checkpoints"
    dirs = [d for d in os.listdir(ckpt_root) if os.path.isdir(os.path.join(ckpt_root, d))]
    print(f"Auditing {len(dirs)} checkpoint directories in {ckpt_root}...")

    results = []
    for d in sorted(dirs):
        dpath = os.path.join(ckpt_root, d)
        weights_files = [f for f in os.listdir(dpath) if f.endswith(".pt")]
        
        cfg_path = os.path.join(dpath, "config.json")
        cfg = {}
        if os.path.exists(cfg_path):
            try:
                cfg = json.load(open(cfg_path, "r", encoding="utf-8"))
            except Exception as e:
                cfg = {"error": str(e)}

        tok_path = os.path.join(dpath, "tokenizer.json")
        has_tok = os.path.exists(tok_path)
        tok_size = os.path.getsize(tok_path) if has_tok else 0

        # Check subdirectories for steps (e.g. step_100, step_250)
        substeps = []
        for sub in os.listdir(dpath):
            subp = os.path.join(dpath, sub)
            if os.path.isdir(subp) and any(f.endswith(".pt") for f in os.listdir(subp)):
                substeps.append(sub)

        for wf in weights_files:
            wpath = os.path.join(dpath, wf)
            wsize = os.path.getsize(wpath)
            
            # Load state dict
            try:
                sd = torch.load(wpath, map_location="cpu", weights_only=False)
                if isinstance(sd, dict) and "model_state_dict" in sd:
                    state_dict = sd["model_state_dict"]
                    has_opt = "optimizer_state_dict" in sd
                elif isinstance(sd, dict) and "weights" in sd:
                    state_dict = sd["weights"]
                    has_opt = "optimizer" in sd
                elif isinstance(sd, dict):
                    state_dict = sd
                    has_opt = False
                else:
                    state_dict = {}
                    has_opt = False

                tensors = {}
                param_sum = 0
                for k, v in state_dict.items():
                    if isinstance(v, torch.Tensor):
                        tensors[k] = {"shape": list(v.shape), "params": v.numel(), "dtype": str(v.dtype)}
                        param_sum += v.numel()

                has_vis = any("vision" in k for k in tensors.keys())
                has_aud = any("audio" in k for k in tensors.keys())
                has_tok_emb = "tok_emb.weight" in tensors
                has_lm_head = "lm_head.weight" in tensors
                
                # Check tying: does lm_head exist as separate tensor in state_dict?
                tied_in_sd = not has_lm_head

                tok_params = tensors.get("tok_emb.weight", {}).get("params", 0)
                lm_head_params = tensors.get("lm_head.weight", {}).get("params", 0)
                vis_params = sum(t["params"] for k, t in tensors.items() if "vision" in k)
                aud_params = sum(t["params"] for k, t in tensors.items() if "audio" in k)
                block_params = sum(t["params"] for k, t in tensors.items() if "blocks" in k)
                norm_params = sum(t["params"] for k, t in tensors.items() if "norm" in k and "blocks" not in k and "vision" not in k)

                sha = sha256_file(wpath)

                results.append({
                    "name": d,
                    "file": wf,
                    "rel_path": os.path.join(dpath, wf).replace("\\", "/"),
                    "size_bytes": wsize,
                    "sha256": sha,
                    "has_optimizer_state": has_opt,
                    "has_tokenizer": has_tok,
                    "tokenizer_size": tok_size,
                    "substeps": substeps,
                    "config": cfg,
                    "tensor_count": len(tensors),
                    "total_params": param_sum,
                    "tok_emb_params": tok_params,
                    "lm_head_params": lm_head_params,
                    "vision_params": vis_params,
                    "audio_params": aud_params,
                    "transformer_block_params": block_params,
                    "norm_params": norm_params,
                    "has_vision": has_vis,
                    "has_audio": has_aud,
                    "tied_in_checkpoint": tied_in_sd,
                    "tensor_breakdown": {k: t["shape"] for k, t in tensors.items()}
                })
            except Exception as e:
                results.append({
                    "name": d,
                    "file": wf,
                    "rel_path": os.path.join(dpath, wf).replace("\\", "/"),
                    "size_bytes": wsize,
                    "error": str(e)
                })

        # Also inspect any substeps like step_100/weights.pt
        for sub in substeps:
            subp = os.path.join(dpath, sub)
            for swf in os.listdir(subp):
                if swf.endswith(".pt"):
                    wpath = os.path.join(subp, swf)
                    wsize = os.path.getsize(wpath)
                    try:
                        sd = torch.load(wpath, map_location="cpu", weights_only=False)
                        state_dict = sd if isinstance(sd, dict) and "model_state_dict" not in sd else sd.get("model_state_dict", {})
                        param_sum = sum(v.numel() for v in state_dict.values() if isinstance(v, torch.Tensor))
                        sha = sha256_file(wpath)
                        results.append({
                            "name": f"{d}/{sub}",
                            "file": swf,
                            "rel_path": wpath.replace("\\", "/"),
                            "size_bytes": wsize,
                            "sha256": sha,
                            "config": cfg,
                            "tensor_count": len(state_dict),
                            "total_params": param_sum
                        })
                    except Exception as e:
                        results.append({
                            "name": f"{d}/{sub}",
                            "file": swf,
                            "rel_path": wpath.replace("\\", "/"),
                            "error": str(e)
                        })

    out_file = "VISION_COMPLETE_CHECKPOINT_INVENTORY.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"total_checkpoints_audited": len(results), "checkpoints": results}, f, indent=2)

    print(f"Audit complete. Audited {len(results)} checkpoints. Saved to {out_file}.")

if __name__ == "__main__":
    main()
