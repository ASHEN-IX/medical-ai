#!/usr/bin/env python3
"""
Autism Detection Model - Local Training Script
Transfer learning with ResNet50 for binary classification
"""

import os
import sys
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime

# TensorFlow & Keras
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import ModelCheckpoint, ReduceLROnPlateau, CSVLogger
from tensorflow.keras import layers
from tensorflow.keras.applications import ResNet50

# Metrics
from sklearn.metrics import confusion_matrix, classification_report

# ============================================================
# CONFIGURATION & PATHS
# ============================================================
print("\n" + "="*60)
print("⚙️  CONFIGURATION & PATHS")
print("="*60 + "\n")

BASE_DIR = '/home/vanitas/Desktop/Kaggle-Autism/data'
OUTPUT_BASE = '/home/vanitas/Desktop/Kaggle-Autism/models/info'

TRAIN_PATH = os.path.join(BASE_DIR, 'train')
VALID_PATH = os.path.join(BASE_DIR, 'valid')
TEST_PATH = os.path.join(BASE_DIR, 'test')

# Output directory
TIMESTAMP = datetime.now().strftime('%Y%m%d_%H%M%S')
OUTPUT_DIR = os.path.join(OUTPUT_BASE, f'training_{TIMESTAMP}')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Training parameters
HEIGHT, WIDTH = 224, 224
BATCH_SIZE = 24
EPOCHS = 5
LEARNING_RATE = 0.0015
L2_REGULARIZATION = 0.015

print(f"✓ Train path: {TRAIN_PATH}")
print(f"✓ Valid path: {VALID_PATH}")
print(f"✓ Test path: {TEST_PATH}")
print(f"✓ Output dir: {OUTPUT_DIR}")
print(f"✓ Config: Input={HEIGHT}x{WIDTH}, Batch={BATCH_SIZE}, Epochs={EPOCHS}, LR={LEARNING_RATE}")

# Verify paths exist
if not os.path.exists(TRAIN_PATH):
    print(f"\n❌ ERROR: Train path does not exist: {TRAIN_PATH}")
    sys.exit(1)

# ============================================================
# GPU SETUP
# ============================================================
print("\n" + "="*60)
print("🔧 GPU SETUP")
print("="*60 + "\n")

gpus = tf.config.list_physical_devices('GPU')
for gpu in gpus:
    tf.config.experimental.set_memory_growth(gpu, True)
print(f"✓ GPUs configured: {len(gpus)} device(s)")

# ============================================================
# DATA LOADING
# ============================================================
print("\n" + "="*60)
print("📊 DATA LOADING")
print("="*60 + "\n")

# Data augmentation for training
train_datagen = ImageDataGenerator(
    horizontal_flip=True,
    rotation_range=45,
    width_shift_range=0.01,
    height_shift_range=0.01,
    rescale=1./255
)

# Validation/Test - only rescale
test_datagen = ImageDataGenerator(rescale=1./255)

print("Loading data generators...")

# Load training data
TrainGen = train_datagen.flow_from_directory(
    TRAIN_PATH,
    target_size=(HEIGHT, WIDTH),
    batch_size=BATCH_SIZE,
    class_mode='categorical'
)
print(f"✓ Train generator created: {TrainGen.samples} samples")

# Load validation data
ValidGen = test_datagen.flow_from_directory(
    VALID_PATH,
    target_size=(HEIGHT, WIDTH),
    batch_size=BATCH_SIZE,
    class_mode='categorical'
)
print(f"✓ Valid generator created: {ValidGen.samples} samples")

# Load test data
TestGen = test_datagen.flow_from_directory(
    TEST_PATH,
    target_size=(HEIGHT, WIDTH),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    shuffle=False
)
print(f"✓ Test generator created: {TestGen.samples} samples")

# ============================================================
# MODEL BUILDING
# ============================================================
print("\n" + "="*60)
print("🧠 BUILDING MODEL")
print("="*60 + "\n")

# Load ResNet50 base model (pre-trained on ImageNet)
base_model = ResNet50(weights='imagenet', include_top=False, input_shape=(HEIGHT, WIDTH, 3))
print("✓ ResNet50 loaded (ImageNet pre-training)")

# Freeze most layers, unfreeze last 30
for layer in base_model.layers[:-30]:
    layer.trainable = False
for layer in base_model.layers[-30:]:
    layer.trainable = True
print("✓ Layer freezing applied (last 30 trainable)")

# Build custom top
x = base_model.output
x = layers.GlobalAveragePooling2D()(x)
x = layers.Flatten()(x)
x = layers.Dense(128, activation='relu', kernel_regularizer=keras.regularizers.l2(L2_REGULARIZATION))(x)
x = layers.Dropout(0.4)(x)
out = layers.Dense(2, activation='softmax')(x)

model = keras.Model(base_model.input, out)
print("✓ Custom layers added (Dense->Dropout->Output)")

# Compile
model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=LEARNING_RATE),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)
print("✓ Model compiled")
print(f"✓ Total parameters: {model.count_params():,}")

# ============================================================
# TRAINING
# ============================================================
print("\n" + "="*60)
print("🚀 TRAINING MODEL")
print("="*60 + "\n")

# Callbacks
callbacks = [
    ModelCheckpoint(
        os.path.join(OUTPUT_DIR, 'best_model.h5'),
        monitor='val_accuracy',
        save_best_only=True,
        verbose=1
    ),
    ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=2,
        min_lr=0.00001,
        verbose=1
    ),
    CSVLogger(os.path.join(OUTPUT_DIR, 'training_log.csv'))
]

# Train model
history = model.fit(
    TrainGen,
    validation_data=ValidGen,
    epochs=EPOCHS,
    callbacks=callbacks,
    verbose=1
)

print("\n✓ Training complete!")

# ============================================================
# EVALUATION
# ============================================================
print("\n" + "="*60)
print("📊 EVALUATION & METRICS")
print("="*60 + "\n")

# Evaluate on test set
test_loss, test_acc = model.evaluate(TestGen, verbose=0)
print(f"Test Accuracy: {test_acc:.4f}")
print(f"Test Loss: {test_loss:.4f}")

# Get predictions
Y_pred = model.predict(TestGen, verbose=0)
Y_pred = np.argmax(Y_pred, axis=1)
Y_true = TestGen.classes

# Confusion matrix
cm = confusion_matrix(Y_true, Y_pred)
print("\nConfusion Matrix:")
print(cm)

# Classification report
print("\nClassification Report:")
print(classification_report(Y_true, Y_pred, target_names=['Autistic', 'Non_Autistic']))

# ============================================================
# SAVE RESULTS
# ============================================================
print("\n" + "="*60)
print("💾 SAVING RESULTS")
print("="*60 + "\n")

# Save model
model.save(os.path.join(OUTPUT_DIR, 'final_model.h5'))
print("✓ Final model saved")

# Training plots
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

ax1.plot(history.history['accuracy'], marker='o', label='Train')
ax1.plot(history.history['val_accuracy'], marker='s', label='Validation')
ax1.set_title('Accuracy', fontsize=12, weight='bold')
ax1.set_xlabel('Epoch')
ax1.set_ylabel('Accuracy')
ax1.legend()
ax1.grid(True, alpha=0.3)

ax2.plot(history.history['loss'], marker='o', label='Train')
ax2.plot(history.history['val_loss'], marker='s', label='Validation')
ax2.set_title('Loss', fontsize=12, weight='bold')
ax2.set_xlabel('Epoch')
ax2.set_ylabel('Loss')
ax2.legend()
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'training_history.png'), dpi=100)
print("✓ Training plots saved")

# Confusion matrix plot
fig, ax = plt.subplots(figsize=(8, 6))
im = ax.imshow(cm, cmap='Blues')
ax.set_xlabel('Predicted', fontsize=12)
ax.set_ylabel('True', fontsize=12)
ax.set_title('Confusion Matrix', fontsize=14, weight='bold')
ax.set_xticks([0, 1])
ax.set_yticks([0, 1])
ax.set_xticklabels(['Autistic', 'Non_Autistic'])
ax.set_yticklabels(['Autistic', 'Non_Autistic'])
plt.colorbar(im)

for i in range(2):
    for j in range(2):
        ax.text(j, i, str(cm[i, j]), ha='center', va='center',
               color='white' if cm[i, j] > cm.max()/2 else 'black', fontsize=16, weight='bold')

plt.savefig(os.path.join(OUTPUT_DIR, 'confusion_matrix.png'), dpi=100)
print("✓ Confusion matrix saved")

print(f"\n✅ All results saved to: {OUTPUT_DIR}")
