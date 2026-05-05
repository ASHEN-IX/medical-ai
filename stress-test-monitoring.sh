#!/bin/bash
# stress-test-monitoring.sh
# Sends a continuous stream of random predictions for multiple models

MODELS=("diabetes" "heart" "autism" "liver" "stroke" "kidney")
BASE_URL="http://localhost:4000"

echo "🚀 Starting multi-model monitoring stress test..."
echo "Press Ctrl+C to stop"

while true; do
  # Pick a random model
  model=${MODELS[$RANDOM % ${#MODELS[@]}]}
  
  # Generate random data
  glucose=$((RANDOM % 150 + 70))
  bmi=$((RANDOM % 20 + 18))
  age=$((RANDOM % 60 + 20))
  confidence=$(awk -v v=$((RANDOM % 40 + 60)) 'BEGIN {printf "%.2f", v/100}')
  latency=$((RANDOM % 150 + 30))
  
  # Randomly trigger drift for some models
  drift="false"
  if [ $((RANDOM % 10)) -eq 0 ]; then
    drift="true"
  fi

  # Send prediction log
  curl -s -X POST "$BASE_URL/api/logs/prediction" \
    -H "Content-Type: application/json" \
    -d "{
      \"report_id\": \"stress-$(date +%s)-$RANDOM\",
      \"model_id\": \"${model}_pred\",
      \"model_version\": \"1.0\",
      \"input\": {
        \"age\": $age,
        \"glucose\": $glucose,
        \"bmi\": $bmi,
        \"blood_pressure\": 80
      },
      \"prediction\": {
        \"risk_level\": \"$([ $glucose -gt 160 ] && echo 'high' || echo 'low')\",
        \"probability\": $confidence
      },
      \"confidence\": $confidence,
      \"processing_time_ms\": $latency,
      \"drift_detected\": $drift,
      \"metadata\": {
        \"test_run\": true,
        \"source\": \"stress-test-script\"
      }
    }" > /dev/null

  echo "Sent prediction for ${model}_pred (confidence: $confidence, drift: $drift)"
  
  # Wait a bit
  sleep 1
done
