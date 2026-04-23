import gradio as gr
import tensorflow as tf
from tensorflow.keras.models import load_model
import numpy as np
from PIL import Image
import os
import warnings
import random

warnings.filterwarnings('ignore')

# Load the trained model
model_path = "final_model.h5"
model = None

def load_model_safe():
    global model
    print("Loading model...")
    
    try:
        # Try standard load
        model = load_model(model_path, compile=False)
        print(f"✓ Model loaded successfully from {model_path}")
        return True
    except Exception as e:
        print(f"⚠ Standard load failed: {e}")
        
    try:
        # Try with safe_mode
        model = load_model(model_path, safe_mode=False, compile=False)
        print(f"✓ Model loaded with safe_mode=False")
        return True
    except Exception as e:
        print(f"⚠ Safe mode load failed: {e}")
        
    return False

# Load model on startup
model_loaded = load_model_safe()

if not model_loaded:
    print("⚠ Running in DEMO MODE - Using random predictions")
    model = None

def preprocess_image(image):
    """Preprocess image for model prediction"""
    # Ensure it's PIL Image
    if isinstance(image, np.ndarray):
        image = Image.fromarray(image.astype('uint8'))
    
    # Resize to model's expected input size
    image = image.resize((224, 224))
    
    # Convert to numpy array and normalize
    img_array = np.array(image) / 255.0
    
    # Add batch dimension
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array

def predict_autism(image):
    """Make prediction on whether the person shows autism traits"""
    try:
        if image is None:
            return "Error: No image provided"
        
        processed_image = preprocess_image(image)
        
        if model is None:
            # Demo mode - return random prediction
            prediction = random.choice(["Autistic", "Non-Autistic"])
            confidence = random.uniform(0.5, 0.99)
            return f"**DEMO MODE** \n\nPrediction: {prediction}\nConfidence: {confidence*100:.1f}%"
        
        # Real prediction
        prediction_result = model.predict(processed_image, verbose=0)
        
        # Handle both single output and multi-class output
        if len(prediction_result.shape) > 1 and prediction_result.shape[1] > 1:
            # Multi-class output
            confidence = float(prediction_result[0][1])
            prediction = "Autistic" if np.argmax(prediction_result[0]) == 1 else "Non-Autistic"
        else:
            # Binary output (single neuron)
            confidence = float(prediction_result[0][0])
            prediction = "Autistic" if confidence > 0.5 else "Non-Autistic"
            if confidence <= 0.5:
                confidence = 1 - confidence
        
        return f"**Prediction**: {prediction}\n\n**Confidence**: {confidence*100:.1f}%"
    
    except Exception as e:
        return f"Error during prediction: {str(e)}"

# Create Gradio interface
with gr.Blocks(title="Autism Detection") as demo:
    gr.Markdown("# 🧠 Autism Detection using Computer Vision")
    gr.Markdown("Upload an image to analyze and get an autism prediction")
    
    with gr.Row():
        with gr.Column():
            gr.Markdown("### Step 1: Upload Image")
            image_input = gr.Image(
                type="pil", 
                label="Upload Image",
                sources=["upload", "webcam", "clipboard"]
            )
            
        with gr.Column():
            gr.Markdown("### Step 2: Results")
            prediction_output = gr.Textbox(
                label="Prediction Results",
                lines=5,
                interactive=False
            )
    
    submit_btn = gr.Button("🔍 Analyze Image", variant="primary", size="lg", scale=2)
    
    gr.Markdown("---")
    gr.Markdown("""
    ### About This Model
    - **Architecture**: ResNet50 Deep Learning Model
    - **Input**: 224 × 224 RGB Images
    - **Output**: Binary Classification (Autistic / Non-Autistic)
    - **Mode**: """ + ("🟢 REAL MODEL" if model_loaded else "🟡 DEMO MODE (Random Predictions)") + """
    """)
    
    submit_btn.click(
        fn=predict_autism,
        inputs=image_input,
        outputs=prediction_output
    )

if __name__ == "__main__":
    print("\n" + "="*60)
    print("Autism Detection - Gradio App")
    print("="*60)
    print(f"Model Status: {'✓ Loaded' if model_loaded else '⚠ Demo Mode'}")
    print("Starting server...\n")
    demo.launch(share=False)

