import json

with open("data/learning/vision_parameter_scaling_analysis.json") as f:
    data = json.load(f)

print(f"{'Preset':<22} | {'Params':<12} | {'FP16 (MB)':<10} | {'Train RAM':<10} | {'Local Status'}")
print("-" * 84)
for k, v in data.items():
    p = v["parameter_breakdown"]["total_parameters"]
    fp16 = v["storage"]["fp16_mb"]
    train_ram = v["training_ram"]["adamw_mb"]
    status = v["hardware_feasibility"]["status"]
    print(f"{k:<22} | {p:>12,} | {fp16:>10.1f} | {train_ram:>7.1f} MB | {status}")

print("\n" + "=" * 84)
print(f"{'Preset':<22} | {'Chinchilla Tokens':<18} | {'1x A100 Hours':<14} | {'Est. Cost ($1.10/hr)'}")
print("-" * 84)
for k, v in data.items():
    tok = f"{v['dataset_needs']['chinchilla_optimal_tokens_b']} B"
    hrs = f"{v['cloud_budget_estimate']['chinchilla_a100_hours']:.1f} hrs"
    cost = f"${v['cloud_budget_estimate']['chinchilla_cost_usd']:,.2f}"
    print(f"{k:<22} | {tok:<18} | {hrs:<14} | {cost}")
