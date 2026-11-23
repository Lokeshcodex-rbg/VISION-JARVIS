#!/bin/bash
# VISION — MADE BY LOKESH | Distributed Cluster Training Runner
# Usage: bash run_cluster.sh 1b

MODEL_SIZE=${1:-"250m"}
GPUS=${2:-8}
OUTPUT_DIR="checkpoints/vision-${MODEL_SIZE}-cloud"

echo "=========================================================="
echo "Launching Distributed FSDP Training for VISION-${MODEL_SIZE}"
echo "Using ${GPUS} GPUs | Output: ${OUTPUT_DIR}"
echo "=========================================================="

mkdir -p ${OUTPUT_DIR}

torchrun --nproc_per_node=${GPUS} ml_foundation/cloud_training/fsdp_train_cloud.py \
    --model-size ${MODEL_SIZE} \
    --batch-size 4 \
    --seq-len 2048 \
    --lr 1.8e-4 \
    --steps 2000 \
    --output-dir ${OUTPUT_DIR}
