# Autism Detection App

A FastAPI-based web application for autism detection using computer vision.

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the App

```bash
python main.py
```

Then open: **http://localhost:8000**

---

## File Structure

```
autism-detection/
├── main.py                 # FastAPI application
├── requirements.txt        # Dependencies
├── final_model.h5         # Trained model file
├── run.sh                 # Linux/Mac startup
└── run.bat                # Windows startup
```

---

## Usage

1. **Upload Image** - Click or drag & drop
2. **Analyze** - Click the Analyze button
3. **Results** - Get prediction and confidence

---

## Features

✅ Simple, clean interface  
✅ Drag & drop upload  
✅ Real-time predictions  
✅ Confidence scores  
✅ Mobile responsive  
✅ Fast inference  

---

## API Endpoints

### GET `/`
Returns the HTML interface

### POST `/predict`
```
Content-Type: multipart/form-data
Body: file (image)
```

**Response:**
```json
{
  "prediction": "Autistic",
  "confidence": "85.5%",
  "error": null
}
```

---

## Troubleshooting

**Port Already in Use:**
Edit `main.py` line 169 and change port:
```python
uvicorn.run(app, host="0.0.0.0", port=8001)
```

**Model Not Loading:**
The app works in demo mode without the model (random predictions).

---

## Requirements

- Python 3.8+
- TensorFlow 2.10+
- FastAPI 0.104+
- Uvicorn 0.24+
