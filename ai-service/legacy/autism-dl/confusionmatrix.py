import os
import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.metrics import confusion_matrix, classification_report, precision_recall_fscore_support

# --- CONFIGURATION ---
HEIGHT, WIDTH = 224, 224
BATCH_SIZE = 32
OUTPUT_DIR = 'results'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load the trained model
model_path = 'Kaggle-Autism/models/info/training_20260415_221233/best_model.h5'
print(f"Loading model from {model_path}")
try:
    model = load_model(model_path, compile=False)
    print("✓ Model loaded successfully")
except Exception as e:
    print(f"⚠ Standard load failed: {e}")
    try:
        # Try with safe_mode
        model = load_model(model_path, safe_mode=False, compile=False)
        print("✓ Model loaded with safe_mode=False")
    except Exception as e2:
        print(f"⚠ Safe mode load failed: {e2}")
        print("Trying to load weights into a new model...")
        # Recreate the model architecture
        from tensorflow.keras.applications import ResNet50
        from tensorflow.keras import layers, models
        
        base_model = ResNet50(weights=None, include_top=False, input_shape=(224, 224, 3))
        base_model.trainable = False
        model = models.Sequential([
            base_model,
            layers.GlobalAveragePooling2D(),
            layers.Dense(256, activation='relu'),
            layers.Dropout(0.5),
            layers.Dense(1, activation='sigmoid')
        ])
        model.load_weights(model_path)
        print("✓ Model weights loaded into recreated architecture")

if model is None:
    raise ValueError("Could not load the model")

# Compile the model
model.compile(
    optimizer='adam',
    loss='categorical_crossentropy',  # Changed to categorical
    metrics=['accuracy']
)
print("✓ Model compiled")
print("Model summary:")
model.summary()

# Data generators
test_datagen = ImageDataGenerator(rescale=1./255)

TestGen = test_datagen.flow_from_directory(
    'Kaggle-Autism/data/test',
    target_size=(HEIGHT, WIDTH),
    batch_size=BATCH_SIZE,
    class_mode='categorical',  # Changed to categorical
    shuffle=False
)
print(f"✓ Test data loaded: {TestGen.samples} samples")

# --- EVALUATION ---
print("\n" + "="*60)
print("📊 EVALUATION")
print("="*60)

# Evaluate on test set
test_loss, test_acc = model.evaluate(TestGen, verbose=0)
print(f"Test Accuracy: {test_acc:.4f}")
print(f"Test Loss: {test_loss:.4f}")

# Get predictions (categorical)
Y_pred_proba = model.predict(TestGen, verbose=0)
Y_pred = np.argmax(Y_pred_proba, axis=1)
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

# --- PLOTTING ---
print("\n" + "="*60)
print("📈 GENERATING PLOTS")
print("="*60)

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
plt.show()

# Save metrics summary
with open(os.path.join(OUTPUT_DIR, 'metrics_summary.txt'), 'w') as f:
    f.write("="*60 + "\n")
    f.write("AUTISM DETECTION MODEL - EVALUATION SUMMARY\n")
    f.write("="*60 + "\n\n")
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