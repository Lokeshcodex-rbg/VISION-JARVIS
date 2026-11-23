#!/usr/bin/env bash
# VISION 8x H100 SXM5 Distributed Pretraining Launcher
# scripts/launch_h100_cluster.sh

set -euo pipefail

NUM_GPUS=${1:-8}
MODEL_SIZE=${2:-"98m"}

case "$MODEL_SIZE" in
    "27m")
        CONFIG="data/neural_models/checkpoints/vision-13m-curriculum-breakthrough/config.json"
        OUTPUT="data/neural_models/checkpoints/vision-27m-h100-pretraining"
        BATCH_SIZE=64
        GRAD_ACCUM=2
        STEPS=5400
        ;;
    "98m")
        CONFIG="data/neural_models/checkpoints/vision-100m-scaling-experiment/config.json"
        OUTPUT="data/neural_models/checkpoints/vision-100m-h100-pretraining"
        BATCH_SIZE=32
        GRAD_ACCUM=4
        STEPS=19500
        ;;
    *)
        echo "Unknown model size: $MODEL_SIZE. Choose 27m or 98m."
        exit 1
        ;;
esac

echo "=========================================================="
echo "LAUNCHING VISION FOUNDATION MODEL CLUSTER TRAINING"
echo "Model: $MODEL_SIZE | GPUs: $NUM_GPUS | Config: $CONFIG"
echo "Output Directory: $OUTPUT"
echo "=========================================================="

export OMP_NUM_THREADS=8
export NCCL_DEBUG=INFO
export NCCL_IB_DISABLE=0
export NCCL_NET_GDR_LEVEL=2

torchrun \
    --nproc_per_node="$NUM_GPUS" \
    --master_port=29500 \
    ml_foundation/cluster_launch_fsdp.py \
    --config "$CONFIG" \
    --output_dir "$OUTPUT" \
    --max_steps "$STEPS" \
    --batch_size "$BATCH_SIZE" \
    --grad_accum "$GRAD_ACCUM" \
    --seq_len 512 \
    --lr 3e-4
