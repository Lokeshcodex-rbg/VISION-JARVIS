import json

def main():
    data = json.load(open("VISION_COMPLETE_CHECKPOINT_INVENTORY.json", "r", encoding="utf-8"))
    ckpts = data["checkpoints"]
    print(f"Total audited entries: {len(ckpts)}")

    target_names = [
        "vision-v1.4-calibrated-local",
        "vision-v1.4-replay-cand-b",
        "vision-2.0-candidate-g",
        "vision-100m-foundation",
        "vision-100m-full-pretraining",
        "vision-100m-recovered",
        "vision-100m-stage3-pretraining",
        "vision-100m-stage4-curated",
        "vision-pretraining-validation-13m",
        "vision-13m-stage4-relational",
        "vision-13m-stage4-relational/step_100",
        "vision-13m-stage3-curriculum",
        "vision-13m-sft-aligned",
        "vision-25m-compact-foundation",
        "vision-v1.5-25m-local",
        "vision-v1.5-25m-recovered"
    ]

    print("\n=== KEY TARGET CHECKPOINTS AUDIT ===")
    for c in ckpts:
        name = c.get("name")
        if any(t == name or (name and name.startswith(t)) for t in target_names):
            cfg = c.get("config", {})
            print(f"Name: {name} | File: {c.get('file')} | Size: {c.get('size_bytes',0):,} bytes")
            print(f"  Total Checkpoint Params: {c.get('total_params',0):,} | Tensors: {c.get('tensor_count',0)} | SHA: {str(c.get('sha256'))[:16]}...")
            print(f"  tok_emb: {c.get('tok_emb_params',0):,} | lm_head: {c.get('lm_head_params',0):,} | vision: {c.get('vision_params',0):,} | audio: {c.get('audio_params',0):,} | blocks: {c.get('transformer_block_params',0):,}")
            print(f"  Config: d_model={cfg.get('d_model')}, layers={cfg.get('n_layers')}, heads={cfg.get('n_heads')}, vocab={cfg.get('vocab_size')}, tie_emb={cfg.get('tie_word_embeddings')}")
            print("-" * 60)

if __name__ == "__main__":
    main()
