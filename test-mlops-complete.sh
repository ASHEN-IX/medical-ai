#!/bin/bash
# Comprehensive MLOps Testing Script
# This script tests all components and generates data for the monitoring dashboards

BASE_URL="http://localhost:4000"
AI_URL="http://localhost:8001"

echo "🧪 MedAI Nexus - Complete MLOps Testing"
echo "========================================"
echo ""

# Function to send a prediction
send_prediction() {
    local model=$1
    local glucose=$2
    local bmi=$3
    local age=$4
    local confidence=$5
    
    curl -s -X POST "$BASE_URL/api/logs/prediction" \
        -H "Content-Type: application/json" \
        -d "{
          \"report_id\": \"test-$(date +%s)-$RANDOM\",
          \"model_id\": \"${model}_pred\",
          \"model_version\": \"1.0\",
          \"input\": {
            \"age\": $age,
            \"glucose\": $glucose,
            \"bmi\": $bmi,
            \"blood_pressure\": 80,
            \"pregnancies\": 2
          },
          \"prediction\": {
            \"risk_level\": \"$([ $glucose -gt 150 ] && echo 'high' || echo 'low')\",
            \"probability\": $confidence
          },
          \"confidence\": $confidence,
          \"processing_time_ms\": $((RANDOM % 100 + 20)),
          \"metadata\": {
            \"test_run\": true
          }
        }" 2>/dev/null
}

echo "1️⃣  Sending Test Predictions..."
echo "---"

# Send 10 varied predictions
for i in {1..10}; do
    echo "Sending prediction $i/10..."
    
    # Vary the values
    glucose=$((RANDOM % 100 + 100))
    bmi=$((RANDOM % 15 + 20))
    age=$((RANDOM % 30 + 40))
    confidence=$(awk -v v=$((RANDOM % 100 + 80)) 'BEGIN {printf "%.2f", v/100}')
    
    send_prediction "diabetes" "$glucose" "$bmi" "$age" "$confidence"
    sleep 1
done

echo "✅ Predictions sent!"
echo ""

echo "2️⃣  Waiting for data to be processed..."
sleep 5
echo ""

echo "3️⃣  Checking Statistics..."
echo "---"
STATS=$(curl -s "$BASE_URL/api/logs/statistics?modelId=diabetes_pred")
echo "$STATS" | jq . 2>/dev/null || echo "$STATS"
echo ""

echo "4️⃣  Checking Model Info..."
echo "---"
MODEL_INFO=$(curl -s "$BASE_URL/api/model/info?modelId=diabetes_pred")
echo "$MODEL_INFO" | jq . 2>/dev/null || echo "$MODEL_INFO"
echo ""

echo "5️⃣  Getting Prediction Logs..."
echo "---"
LOGS=$(curl -s "$BASE_URL/api/logs/predictions?modelId=diabetes_pred&limit=3")
echo "$LOGS" | jq . 2>/dev/null || echo "$LOGS"
echo ""

echo "6️⃣  Checking Prometheus Metrics..."
echo "---"
METRICS=$(curl -s "$AI_URL/metrics" 2>/dev/null | head -30)
if [ $? -eq 0 ]; then
    echo "$METRICS"
    echo "... (truncated)"
else
    echo "⚠️  Metrics endpoint not available yet"
fi
echo ""

echo "✅ Testing Complete!"
echo ""
echo "📊 View the Results:"
echo "   Grafana Dashboard: http://localhost:3001 (admin/admin)"
echo "   Prometheus: http://localhost:9090"
echo "   Frontend App: http://localhost:3000"
echo "   Monitoring Dashboard: http://localhost:3000/monitoring"
echo ""
echo "💡 Tips:"
echo "   - Refresh the Grafana dashboard to see new data"
echo "   - Check the Prometheus metrics endpoint: http://localhost:8001/metrics"
echo "   - Run this script multiple times to generate more data"
