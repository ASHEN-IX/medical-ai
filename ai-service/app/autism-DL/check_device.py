#!/usr/bin/env python3
"""Check GPU/CPU availability"""

import tensorflow as tf

print("="*60)
print("🔍 TensorFlow GPU/CPU DIAGNOSTIC")
print("="*60 + "\n")

# Check TensorFlow version
print(f"TensorFlow version: {tf.__version__}\n")

# Check physical devices
gpus = tf.config.list_physical_devices('GPU')
cpus = tf.config.list_physical_devices('CPU')

print(f"Physical GPUs detected: {len(gpus)}")
for i, gpu in enumerate(gpus):
    print(f"  GPU {i}: {gpu}")

print(f"\nPhysical CPUs detected: {len(cpus)}")
for i, cpu in enumerate(cpus):
    print(f"  CPU {i}: {cpu}")

# Check logical devices
logical_gpus = tf.config.list_logical_devices('GPU')
logical_cpus = tf.config.list_logical_devices('CPU')

print(f"\nLogical GPUs: {len(logical_gpus)}")
print(f"Logical CPUs: {len(logical_cpus)}")

# Check build info
print(f"\nBuilt with CUDA: {tf.test.is_built_with_cuda()}")
print(f"Built with GPU support: {tf.test.is_gpu_available(cuda_only=False)}")

# Compute device test
print("\n" + "="*60)
print("Testing compute device placement...")
print("="*60 + "\n")

with tf.device('/CPU:0'):
    a = tf.constant([[1.0, 2.0], [3.0, 4.0]])
    b = tf.constant([[1.0, 2.0], [3.0, 4.0]])
    c = tf.matmul(a, b)
    print(f"CPU computation result:\n{c}")

if len(gpus) > 0:
    with tf.device('/GPU:0'):
        a = tf.constant([[1.0, 2.0], [3.0, 4.0]])
        b = tf.constant([[1.0, 2.0], [3.0, 4.0]])
        c = tf.matmul(a, b)
        print(f"\nGPU computation result:\n{c}")
else:
    print("\n⚠️  No GPU detected - will use CPU")
