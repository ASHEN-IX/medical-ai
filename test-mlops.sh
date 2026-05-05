#!/bin/bash
# Test script for MedAI Nexus MLOps monitoring

BASE_URL="http://localhost:4000"
AI_URL="http://localhost:8001"

echo "🧪 Testing MedAI Nexus MLOps + AIOps"
echo "======================================"
echo ""

# Test 1: Health checks
echo "1️⃣  Health Checks"
echo "---"
echo "Backend health:"
curl -s http://localhost:4000/health 2>/dev/null || echo "Backend not ready yet"
echo ""
echo "AI Service health:"
curl -s http://localhost:8001/health 2>/dev/null || echo "AI Service not ready yet"
echo ""

# Test 2: Log a prediction to backend
echo "2️⃣  Log Prediction Event"
echo "---"
PREDICTION_DATA='{
  "report_id": "test-report-001",
  "model_id": "diabetes_pred",
  "model_version": "1.0",
  "input": {
    "age": 45,
    "glucose": 180,
    "bmi": 28.5,
    "blood_pressure": 80,
    "pregnancies": 2
  },
  "prediction": {
    "risk_level": "high",
    "probability": 0.85
  },
  "confidence": 0.92,
  "processing_time_ms": 45.2,
  "metadata": {
    "model_name": "Random Forest",
    "training_date": "2025-12-01"
  }
}'

echo "Sending prediction log..."
curl -s -X POST "$BASE_URL/api/logs/prediction" \
  -H "Content-Type: application/json" \
  -d "$PREDICTION_DATA" | jq . 2>/dev/null || echo "Could not log prediction"
echo ""

# Test 3: Retrieve statistics
echo "3️⃣  Get Model Statistics"
echo "---"
echo "Fetching diabetes_pred statistics..."
curl -s "$BASE_URL/api/logs/statistics?modelId=diabetes_pred" | jq . 2>/dev/null || echo "No stats available yet"
echo ""

# Test 4: Get model info
echo "4️⃣  Get Model Information"
echo "---"
curl -s "$BASE_URL/api/model/info?modelId=diabetes_pred" | jq . 2>/dev/null || echo "No model info available yet"
echo ""

# Test 5: Check Prometheus metrics
echo "5️⃣  Prometheus Metrics"
echo "---"
echo "Checking if metrics are exposed..."
curl -s "$AI_URL/metrics" 2>/dev/null | head -20 || echo "Metrics endpoint not ready"
echo ""

# Test 6: Get drift alerts
echo "6️⃣  Drift Alerts"
echo "---"
curl -s "$BASE_URL/api/logs/drift-alerts?modelId=diabetes_pred" | jq . 2>/dev/null || echo "No drift alerts yet"
echo ""

echo "✅ Testing Complete!"
echo ""
echo "📊 Next Steps:"
echo "1. Open Grafana: http://localhost:3001 (admin/admin)"
echo "2. Open Prometheus: http://localhost:9090"
echo "3. Open Frontend: http://localhost:3000"
echo "4. Check monitoring dashboard at /monitoring"
