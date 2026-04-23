#!/usr/bin/env python3
"""
Autism Detection Model - Kaggle Training Script
Two-phase training: Head first, then fine-tune ResNet
Binary classification with ResNet50 transfer learning
"""

import os
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import ResNet50
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.metrics import confusion_matrix, classification_report, precision_recall_fscore_support

# --- CONFIGURATION ---
HEIGHT, WIDTH = 224, 224
BATCH_SIZE = 32
INITIAL_LR = 0.001    # Higher for the new head
FINETUNE_LR = 0.00001 # Very low for the ResNet layers
EPOCHS_PHASE_1 = 3    # Just to stabilize the head
EPOCHS_PHASE_2 = 12   # Deep learning

OUTPUT_DIR = '/kaggle/working/results'
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("\n" + "="*60)
print("⚙️  CONFIGURATION")
print("="*60)
print(f"Input size: {HEIGHT}x{WIDTH}")
print(f"Batch size: {BATCH_SIZE}")
print(f"Phase 1: {EPOCHS_PHASE_1} epochs @ LR={INITIAL_LR}")
print(f"Phase 2: {EPOCHS_PHASE_2} epochs @ LR={FINETUNE_LR}")
print(f"Output dir: {OUTPUT_DIR}")

# --- 1. DATA PREPARATION ---
print("\n" + "="*60)
print("📊 DATA PREPARATION")
print("="*60)

train_datagen = ImageDataGenerator(rescale=1./255, horizontal_flip=True, rotation_range=20)
test_datagen = ImageDataGenerator(rescale=1./255)

TrainGen = train_datagen.flow_from_directory(
    '/kaggle/input/kaggle-autism/data/train',
    target_size=(HEIGHT, WIDTH),
    batch_size=BATCH_SIZE,
    class_mode='binary'
)
print(f"✓ Train: {TrainGen.samples} samples")

ValidGen = test_datagen.flow_from_directory(
    '/kaggle/input/kaggle-autism/data/valid',
    target_size=(HEIGHT, WIDTH),
    batch_size=BATCH_SIZE,
    class_mode='binary'
)
print(f"✓ Valid: {ValidGen.samples} samples")

TestGen = test_datagen.flow_from_directory(
    '/kaggle/input/kaggle-autism/data/test',
    target_size=(HEIGHT, WIDTH),
    batch_size=BATCH_SIZE,
    class_mode='binary',
    shuffle=False
)
print(f"✓ Test: {TestGen.samples} samples")

# --- 2. MODEL BUILDING ---
print("\n" + "="*60)
print("🧠 MODEL BUILDING")
print("="*60)

base_model = ResNet50(weights='imagenet', include_top=False, input_shape=(HEIGHT, WIDTH, 3))
base_model.trainable = False  # FREEZE the base initially
print("✓ ResNet50 loaded (ImageNet pre-trained)")

model = keras.Sequential([
    base_model,
    layers.GlobalAveragePooling2D(),
    layers.Dense(256, activation='relu'),
    layers.Dropout(0.5),
    layers.Dense(1, activation='sigmoid')  # Sigmoid for binary classification
])
print("✓ Model architecture built")
print(f"✓ Total parameters: {model.count_params():,}")

# --- 3. PHASE 1: TRAIN THE HEAD ONLY ---
print("\n" + "="*60)
print("🚀 PHASE 1: TRAINING CUSTOM HEAD")
print("="*60)

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=INITIAL_LR),
    loss='binary_crossentropy',
    metrics=['accuracy']
)
print(f"✓ Compiled (LR={INITIAL_LR}, binary_crossentropy)")

history_phase1 = model.fit(
    TrainGen,
    validation_data=ValidGen,
    epochs=EPOCHS_PHASE_1,
    verbose=1
)
print("✓ Phase 1 complete!")

# --- 4. PHASE 2: FINE-TUNING ---
print("\n" + "="*60)
print("🚀 PHASE 2: FINE-TUNING RESNET LAYERS")
print("="*60)

base_model.trainable = True
print("✓ Base model unfrozen")

# Unfreeze only the last 30 layers to keep training stable
for layer in base_model.layers[:-30]:
    layer.trainable = False
print("✓ Last 30 layers set to trainable")

# CRITICAL: Recompile with a MUCH smaller learning rate
model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=FINETUNE_LR),
    loss='binary_crossentropy',
    metrics=['accuracy']
)
print(f"✓ Recompiled (LR={FINETUNE_LR})")

history_phase2 = model.fit(
    TrainGen,
    validation_data=ValidGen,
    epochs=EPOCHS_PHASE_2,
    verbose=1
)
print("✓ Phase 2 complete!")

# Combine histories
history_accuracy = history_phase1.history['accuracy'] + history_phase2.history['accuracy']
history_val_accuracy = history_phase1.history['val_accuracy'] + history_phase2.history['val_accuracy']
history_loss = history_phase1.history['loss'] + history_phase2.history['loss']
history_val_loss = history_phase1.history['val_loss'] + history_phase2.history['val_loss']

# --- 5. EVALUATION ---
print("\n" + "="*60)
print("📊 EVALUATION")
print("="*60)

# Evaluate on test set
test_loss, test_acc = model.evaluate(TestGen, verbose=0)
print(f"Test Accuracy: {test_acc:.4f}")
print(f"Test Loss: {test_loss:.4f}")

# Get predictions (binary)
Y_pred_proba = model.predict(TestGen, verbose=0).flatten()
Y_pred = (Y_pred_proba > 0.5).astype(int)
Y_true = TestGen.classes

# Confusion matrix
cm = confusion_matrix(Y_true, Y_pred)
print("\nConfusion Matrix:")
print(cm)

# Classification report
print("\nClassification Report:")
print(classification_report(Y_true, Y_pred, target_names=['Autistic', 'Non_Autistic']))

# Detailed metrics
precision, recall, f1, _ = precision_recall_fscore_support(Y_true, Y_pred, average='weighted')
print(f"\nWeighted Metrics:")
print(f"  Precision: {precision:.4f}")
print(f"  Recall: {recall:.4f}")
print(f"  F1-Score: {f1:.4f}")

# --- 6. SAVE RESULTS ---
print("\n" + "="*60)
print("💾 SAVING RESULTS")
print("="*60)

# Save models
model.save(os.path.join(OUTPUT_DIR, 'final_model.h5'))
print("✓ Model saved (H5)")

model.save(os.path.join(OUTPUT_DIR, 'final_model'))
print("✓ Model saved (SavedModel format)")

# Training history plot
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

ax1.plot(history_accuracy, marker='o', linewidth=2, label='Train')
ax1.plot(history_val_accuracy, marker='s', linewidth=2, label='Validation')
ax1.axvline(x=EPOCHS_PHASE_1, color='r', linestyle='--', alpha=0.5, label='Phase 2 Start')
ax1.set_title('Model Accuracy', fontsize=14, weight='bold')
ax1.set_xlabel('Epoch', fontsize=12)
ax1.set_ylabel('Accuracy', fontsize=12)
ax1.legend(fontsize=11)
ax1.grid(True, alpha=0.3)

ax2.plot(history_loss, marker='o', linewidth=2, label='Train')
ax2.plot(history_val_loss, marker='s', linewidth=2, label='Validation')
ax2.axvline(x=EPOCHS_PHASE_1, color='r', linestyle='--', alpha=0.5, label='Phase 2 Start')
ax2.set_title('Model Loss', fontsize=14, weight='bold')
ax2.set_xlabel('Epoch', fontsize=12)
ax2.set_ylabel('Loss', fontsize=12)
ax2.legend(fontsize=11)
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'training_history.png'), dpi=100, bbox_inches='tight')
print("✓ Training plots saved")
plt.show()

# Confusion matrix plot
fig, ax = plt.subplots(figsize=(8, 7))
im = ax.imshow(cm, cmap='Blues', aspect='auto')
ax.set_xlabel('Predicted', fontsize=12, weight='bold')
ax.set_ylabel('True', fontsize=12, weight='bold')
ax.set_title('Confusion Matrix', fontsize=14, weight='bold')
ax.set_xticks([0, 1])
ax.set_yticks([0, 1])
ax.set_xticklabels(['Autistic', 'Non_Autistic'], fontsize=11)
ax.set_yticklabels(['Autistic', 'Non_Autistic'], fontsize=11)
plt.colorbar(im, ax=ax)

for i in range(2):
    for j in range(2):
        text_color = 'white' if cm[i, j] > cm.max()/2 else 'black'
        ax.text(j, i, str(cm[i, j]), ha='center', va='center',
               color=text_color, fontsize=20, weight='bold')

plt.savefig(os.path.join(OUTPUT_DIR, 'confusion_matrix.png'), dpi=100, bbox_inches='tight')
print("✓ Confusion matrix saved")

# Save metrics summary
with open(os.path.join(OUTPUT_DIR, 'metrics_summary.txt'), 'w') as f:
    f.write("="*60 + "\n")
    f.write("AUTISM DETECTION MODEL - TRAINING SUMMARY\n")
    f.write("="*60 + "\n\n")
    f.write(f"Phase 1: {EPOCHS_PHASE_1} epochs @ LR={INITIAL_LR}\n")
    f.write(f"Phase 2: {EPOCHS_PHASE_2} epochs @ LR={FINETUNE_LR}\n\n")
    f.write(f"Test Accuracy: {test_acc:.4f}\n")
    f.write(f"Test Loss: {test_loss:.4f}\n")
    f.write(f"Precision: {precision:.4f}\n")
    f.write(f"Recall: {recall:.4f}\n")
    f.write(f"F1-Score: {f1:.4f}\n\n")
    f.write(f"Confusion Matrix:\n{cm}\n\n")
    f.write(f"Classification Report:\n")
    f.write(classification_report(Y_true, Y_pred, target_names=['Autistic', 'Non_Autistic']))

print("✓ Metrics summary saved")

print(f"\n✅ All results saved to: {OUTPUT_DIR}")
print("="*60 + "\n")
