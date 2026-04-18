# ai-service - AI Intelligence Layer

> Python FastAPI service for MedAI Nexus healthcare platform

## 📋 Overview

This is the **AI intelligence engine** for MedAI Nexus. It provides:

- ✅ ML model inference (PyTorch, scikit-learn)
- ✅ OCR & NLP preprocessing
- ✅ Feature extraction & enrichment
- ✅ Retrieval-Augmented Generation (RAG)
- ✅ Knowledge Graph queries (Neo4j)
- ✅ LLM orchestration (LangChain)
- ✅ Real-time analysis pipeline

## 🏗️ Architecture Rules

### ✅ RESPONSIBILITIES
- Document preprocessing (OCR, NLP)
- Named Entity Recognition (NER)
- Feature extraction from medical data
- ML model selection & inference
- RAG system (vector DB queries)
- Neo4j knowledge graph operations
- LLM prompt building & orchestration
- Response formatting & validation
- Statistical analysis & confidence scoring

### ❌ DO NOT INCLUDE
- ❌ User authentication
- ❌ Authorization logic
- ❌ User session management
- ❌ User/role management
- ❌ Database writes (read-only PostgreSQL)
- ❌ API rate limiting (NestJS handles it)
- ❌ File storage management
- ❌ Web interface

## 📁 Project Structure

```
ai-service/
├── app/
│   ├── main.py            # FastAPI application
│   ├── config.py          # Configuration management
│   ├── middleware.py      # CORS, error handling, logging
│   │
│   ├── api/
│   │   ├── routes.py      # FastAPI route handlers
│   │   ├── schemas.py     # Pydantic request/response models
│   │   └── dependencies.py # FastAPI dependencies
│   │
│   ├── services/          # Business logic services
│   │   ├── preprocessing.py      # OCR, text cleaning
│   │   ├── feature_extraction.py # Medical concept extraction
│   │   ├── model_inference.py    # ML model inference
│   │   ├── rag_service.py        # RAG with FAISS/Chroma
│   │   ├── graph_service.py      # Neo4j queries
│   │   └── llm_orchestration.py  # LangChain integration
│   │
│   ├── models/            # ML model management
│   │   ├── model_registry.py # Model loading & caching
│   │   ├── pytorch_models.py # PyTorch model wrappers
│   │   └── sklearn_models.py # scikit-learn model wrappers
│   │
│   ├── data/
│   │   ├── embeddings.py   # Embedding generation
│   │   ├── vector_store.py # FAISS/Chroma interface
│   │   └── knowledge_graph.py # Neo4j driver setup
│   │
│   ├── utils/
│   │   ├── logging.py      # Structured logging
│   │   ├── errors.py       # Custom exceptions
│   │   ├── validators.py   # Data validation
│   │   └── constants.py    # Constants
│   │
│   └── __tests__/          # Tests
│       ├── test_preprocessing.py
│       ├── test_models.py
│       ├── test_services.py
│       └── conftest.py
│
├── models/                # Pre-trained ML models
│   ├── pytorch/
│   │   ├── cardiovascular_v2.pth
│   │   ├── respiratory_v1.pth
│   │   └── general_v1.pth
│   └── sklearn/
│       ├── diabetes_v1.pkl
│       └── classifier_v1.pkl
│
├── data/                  # Data storage
│   ├── faiss/
│   │   └── medical_index.faiss
│   ├── embeddings/
│   └── knowledge_graph/
│
├── pyproject.toml        # Python project metadata
├── requirements.txt      # Python dependencies
├── .env.local           # Local environment (gitignored)
├── .env.example         # Example environment
├── Dockerfile.ai        # Docker image
└── README.md           # This file
```

## 🚀 Development Setup

### Prerequisites
- Python 3.10+
- pip or poetry
- GPU support (optional but recommended)

### Local Development
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env.local

# Start development server
python -m uvicorn app.main:app --reload --port 8001

# API runs on http://localhost:8001
```

### With Docker
```bash
# Build image
docker build -f Dockerfile.ai -t medai-ai:latest .

# Run container
docker run -p 8001:8001 \
  -e OPENAI_API_KEY=sk-xxx \
  -e NEO4J_URL=bolt://host.docker.internal:7687 \
  medai-ai:latest
```

### Environment Variables
```bash
# .env.local
ENVIRONMENT=development
PORT=8001
LOG_LEVEL=INFO

# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.3

# Neo4j
NEO4J_URL=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password

# Database (read-only)
DATABASE_URL=postgresql://user:password@localhost:5432/medai

# Storage
FAISS_DATA_PATH=/data/faiss
MODELS_PATH=/models
```

## 📦 Key Dependencies

```python
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
torch==2.0.0
scikit-learn==1.3.0
numpy==1.24.0
pandas==2.0.0
langchain==0.0.350
openai==0.27.0
neo4j==5.13.0
faiss-cpu==1.7.4  # or faiss-gpu
pytesseract==0.3.10
pillow==10.0.0
python-dotenv==1.0.0
pydantic-settings==2.0.0
```

## 🔧 Common Development Tasks

### Creating a New Service

```python
# app/services/my_service.py
from typing import Optional
from pydantic import BaseModel

class MyServiceInput(BaseModel):
    data: str

class MyServiceOutput(BaseModel):
    result: str

class MyService:
    async def process(self, input_data: MyServiceInput) -> MyServiceOutput:
        # Implementation
        return MyServiceOutput(result="processed")
```

### Adding a New API Route

```python
# app/api/routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.my_service import MyService, MyServiceInput

router = APIRouter(prefix="/api", tags=["analysis"])
my_service = MyService()

@router.post("/process")
async def process_data(data: MyServiceInput):
    try:
        result = await my_service.process(data)
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Loading ML Models

```python
# app/models/model_registry.py
from pathlib import Path
import torch
import joblib

class ModelRegistry:
    def __init__(self, models_path: str):
        self.models_path = Path(models_path)
        self._cache = {}
    
    def load_pytorch_model(self, model_name: str):
        """Load PyTorch model from disk"""
        if model_name in self._cache:
            return self._cache[model_name]
        
        model_path = self.models_path / f"{model_name}.pth"
        model = torch.load(model_path)
        model.eval()
        
        self._cache[model_name] = model
        return model
    
    def load_sklearn_model(self, model_name: str):
        """Load scikit-learn model from disk"""
        if model_name in self._cache:
            return self._cache[model_name]
        
        model_path = self.models_path / f"{model_name}.pkl"
        model = joblib.load(model_path)
        
        self._cache[model_name] = model
        return model
```

### OCR & Text Preprocessing

```python
# app/services/preprocessing.py
import pytesseract
from PIL import Image
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords

class PreprocessingService:
    def extract_text_from_image(self, image_path: str) -> str:
        """Extract text from image using OCR"""
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        return text
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Lowercase
        text = text.lower()
        # Remove special characters
        text = ''.join(c for c in text if c.isalnum() or c.isspace())
        return text
    
    def tokenize(self, text: str) -> list[str]:
        """Tokenize text into words"""
        tokens = word_tokenize(text)
        # Remove stopwords
        stop_words = set(stopwords.words('english'))
        tokens = [t for t in tokens if t not in stop_words]
        return tokens
```

### Feature Extraction

```python
# app/services/feature_extraction.py
import spacy
from typing import List, Dict

class FeatureExtractor:
    def __init__(self):
        self.nlp = spacy.load("en_core_sci_md")  # Medical model
    
    def extract_entities(self, text: str) -> List[Dict]:
        """Extract medical entities using NER"""
        doc = self.nlp(text)
        entities = []
        
        for ent in doc.ents:
            entities.append({
                "text": ent.text,
                "type": ent.label_,
                "confidence": 0.95  # Would be actual confidence
            })
        
        return entities
    
    def extract_medical_features(self, text: str) -> Dict:
        """Extract structured medical features"""
        entities = self.extract_entities(text)
        
        features = {
            "diseases": [e for e in entities if e["type"] == "DISEASE"],
            "medications": [e for e in entities if e["type"] == "MEDICATION"],
            "symptoms": [e for e in entities if e["type"] == "SYMPTOM"],
            "lab_values": [e for e in entities if e["type"] == "LAB_VALUE"],
        }
        
        return features
```

### RAG with FAISS

```python
# app/services/rag_service.py
import faiss
from typing import List, Dict
import openai

class RAGService:
    def __init__(self, faiss_index_path: str):
        self.index = faiss.read_index(faiss_index_path)
        self.embeddings_model = "text-embedding-3-small"
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embeddings using OpenAI"""
        response = openai.Embedding.create(
            input=text,
            model=self.embeddings_model
        )
        return response["data"][0]["embedding"]
    
    def retrieve_similar_cases(
        self, 
        query_text: str, 
        k: int = 3
    ) -> List[Dict]:
        """Retrieve k most similar cases"""
        query_embedding = self.embed_text(query_text)
        
        # Search in FAISS index
        distances, indices = self.index.search([query_embedding], k)
        
        results = []
        for distance, idx in zip(distances[0], indices[0]):
            results.append({
                "case_id": idx,
                "similarity": 1 - (distance / 2),  # Convert distance to similarity
            })
        
        return results
```

### Knowledge Graph Queries

```python
# app/services/graph_service.py
from neo4j import GraphDatabase

class GraphService:
    def __init__(self, neo4j_url: str, username: str, password: str):
        self.driver = GraphDatabase.driver(
            neo4j_url, 
            auth=(username, password)
        )
    
    def find_disease_treatments(self, disease_name: str) -> List[Dict]:
        """Find treatments for a disease"""
        query = """
        MATCH (d:Disease)-[:TREATED_BY]->(t:Treatment)
        WHERE d.name = $disease_name
        RETURN t.name, t.type, t.description
        """
        
        with self.driver.session() as session:
            results = session.run(query, disease_name=disease_name)
            return [dict(record) for record in results]
    
    def find_related_diseases(self, disease_name: str) -> List[Dict]:
        """Find diseases related to given disease"""
        query = """
        MATCH (d:Disease)-[:RELATED_TO*1..2]-(related:Disease)
        WHERE d.name = $disease_name
        RETURN DISTINCT related.name, related.icdCode
        """
        
        with self.driver.session() as session:
            results = session.run(query, disease_name=disease_name)
            return [dict(record) for record in results]
```

### LLM Orchestration with LangChain

```python
# app/services/llm_orchestration.py
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.chains import LLMChain

class LLMOrchestrator:
    def __init__(self, model: str = "gpt-4"):
        self.llm = ChatOpenAI(model=model, temperature=0.3)
    
    async def generate_clinical_explanation(
        self,
        patient_data: dict,
        predictions: dict,
        retrieved_context: list,
    ) -> str:
        """Generate clinical explanation using LLM"""
        
        template = """
        Based on the following patient data and analysis results, 
        provide a clinical explanation:
        
        Patient Data:
        {patient_data}
        
        Analysis Results:
        {predictions}
        
        Similar Cases:
        {retrieved_context}
        
        Provide a structured clinical explanation including:
        1. Primary diagnosis
        2. Confidence level
        3. Contributing factors
        4. Recommended treatments
        5. Risk factors to monitor
        """
        
        prompt = ChatPromptTemplate.from_template(template)
        chain = LLMChain(llm=self.llm, prompt=prompt)
        
        response = await chain.arun(
            patient_data=str(patient_data),
            predictions=str(predictions),
            retrieved_context=str(retrieved_context),
        )
        
        return response
```

### Model Inference

```python
# app/services/model_inference.py
import torch
import numpy as np
from app.models.model_registry import ModelRegistry

class ModelInferenceService:
    def __init__(self, models_path: str):
        self.registry = ModelRegistry(models_path)
    
    async def predict_diagnosis(
        self,
        features: np.ndarray,
        model_name: str = "general_v1"
    ) -> Dict:
        """Run model inference"""
        model = self.registry.load_pytorch_model(model_name)
        
        # Convert to tensor
        tensor_input = torch.FloatTensor(features)
        
        # Run inference
        with torch.no_grad():
            output = model(tensor_input)
        
        # Process output
        probabilities = torch.softmax(output, dim=1)[0]
        
        return {
            "predictions": probabilities.tolist(),
            "primary": probabilities.argmax().item(),
            "confidence": probabilities.max().item(),
        }
```

## ✅ Testing

### Running Tests
```bash
# Run all tests
pytest

# Run specific test file
pytest app/tests/test_preprocessing.py

# With coverage
pytest --cov=app --cov-report=html

# Watch mode
pytest-watch
```

### Example Test
```python
# app/tests/test_preprocessing.py
import pytest
from app.services.preprocessing import PreprocessingService

@pytest.fixture
def service():
    return PreprocessingService()

def test_clean_text(service):
    text = "HELLO!!! World???"
    cleaned = service.clean_text(text)
    assert cleaned == "hello world"

def test_tokenize(service):
    text = "The patient has diabetes"
    tokens = service.tokenize(text)
    assert "patient" in tokens
    assert "diabetes" in tokens
```

## 📊 Performance Optimization

### Model Caching
```python
# Load models once at startup
from fastapi import FastAPI
from app.models.model_registry import ModelRegistry

app = FastAPI()
model_registry = None

@app.on_event("startup")
async def startup():
    global model_registry
    model_registry = ModelRegistry("/models")
    # Pre-load common models
    model_registry.load_pytorch_model("general_v1")
```

### Batch Processing
```python
# Process multiple inputs at once
async def batch_predict(documents: List[str]) -> List[Dict]:
    # Extract features for all documents
    features_list = [extract_features(doc) for doc in documents]
    
    # Stack into batch tensor
    batch = torch.stack(features_list)
    
    # Single forward pass
    with torch.no_grad():
        outputs = model(batch)
    
    return process_batch_output(outputs)
```

## 🐛 Troubleshooting

### Module Import Errors
```bash
# Add ai-service to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:/path/to/ai-service"

# Or run from correct directory
cd ai-service
python -m uvicorn app.main:app
```

### Neo4j Connection Failed
```bash
# Check Neo4j is running
docker-compose ps | grep neo4j

# Test connection
python -c "from neo4j import GraphDatabase; print(GraphDatabase.driver('bolt://localhost:7687'))"

# Check credentials in .env.local
```

### Model Loading Issues
```bash
# Verify models directory exists
ls -la models/

# Check model file extensions (.pth for PyTorch, .pkl for sklearn)
# Ensure correct paths in environment variables
```

### Memory Issues
```bash
# Reduce batch size
# Or run on GPU (install faiss-gpu)
# Monitor memory usage: nvidia-smi
```

## 📝 Code Style

- **Language:** Python 3.10+
- **Format:** Black formatter
- **Linting:** Flake8 / Pylint
- **Type Hints:** Required
- **Docstrings:** Google style

## 🚀 Production Build

```bash
# Build image
docker build -f Dockerfile.ai -t medai-ai:latest .

# Run with GPU support
docker run --gpus all \
  -e OPENAI_API_KEY=sk-xxx \
  -p 8001:8001 \
  medai-ai:latest
```

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [PyTorch Documentation](https://pytorch.org/docs)
- [scikit-learn Documentation](https://scikit-learn.org)
- [LangChain Documentation](https://python.langchain.com)
- [FAISS Documentation](https://faiss.ai/)
- [Neo4j Python Driver](https://neo4j.com/docs/python-manual/)

---

**Part of MedAI Nexus Platform**  
See [../ARCHITECTURE.md](../ARCHITECTURE.md) for full system design.
