import json

data = json.load(open("VISION_COMPLETE_CHECKPOINT_INVENTORY.json", "r", encoding="utf-8"))
for c in data["checkpoints"]:
    if "stage4-relational" in c.get("name", ""):
        print("Checkpoint:", c.get("name"), c.get("file"))
        print(f"Total params in ckpt: {c.get('total_params', 0):,}")
        print("Tensor count:", c.get("tensor_count"))
        print("Config:", c.get("config"))
        print("tok_emb:", c.get("tok_emb_params"), "lm_head:", c.get("lm_head_params"), "vision:", c.get("vision_params"), "audio:", c.get("audio_params"), "blocks:", c.get("transformer_block_params"))
        print("Tensors:")
        tb = c.get("tensor_breakdown", {})
        for k, v in list(tb.items())[:15]:
            print(" ", k, v)
        print(" ...")
        for k, v in list(tb.items())[-10:]:
            print(" ", k, v)
        print("="*60)
