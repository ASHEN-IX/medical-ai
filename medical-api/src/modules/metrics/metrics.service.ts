import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  async getMetrics(): Promise<string> {
    const allLogs = await this.prisma.predictionLog.findMany();
    
    // Group logs by modelId
    const modelIds = [...new Set(allLogs.map(l => l.modelId))];
    
    let metrics = '';

    // Headers
    metrics += '# HELP inference_requests_total Total number of inference requests\n';
    metrics += '# TYPE inference_requests_total counter\n';
    
    metrics += '# HELP inference_latency_seconds Inference latency in seconds\n';
    metrics += '# TYPE inference_latency_seconds histogram\n';
    
    metrics += '# HELP inference_errors_total Total number of inference errors\n';
    metrics += '# TYPE inference_errors_total counter\n';
    
    metrics += '# HELP prediction_confidence_avg Average prediction confidence\n';
    metrics += '# TYPE prediction_confidence_avg gauge\n';
    
    metrics += '# HELP drift_alerts_total Total number of drift alerts detected\n';
    metrics += '# TYPE drift_alerts_total counter\n';
    metrics += '\n';

    for (const modelId of modelIds) {
      const logs = allLogs.filter(l => l.modelId === modelId);
      const totalRequests = logs.length;
      const driftAlerts = logs.filter(l => l.driftDetected).length;
      const avgConfidence = totalRequests > 0 
        ? logs.reduce((sum, l) => sum + l.confidence, 0) / totalRequests 
        : 0;
      
      const totalLatency = logs.reduce((sum, l) => sum + (l.processingTimeMs / 1000), 0);
      
      // Requests
      metrics += `inference_requests_total{model_id="${modelId}",status="success"} ${totalRequests}\n`;

      // Latency Buckets
      const buckets = [0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0];
      buckets.forEach(b => {
        const count = logs.filter(l => (l.processingTimeMs / 1000) <= b).length;
        metrics += `inference_latency_seconds_bucket{model_id="${modelId}",le="${b}"} ${count}\n`;
      });
      metrics += `inference_latency_seconds_bucket{model_id="${modelId}",le="+Inf"} ${totalRequests}\n`;
      metrics += `inference_latency_seconds_sum{model_id="${modelId}"} ${totalLatency}\n`;
      metrics += `inference_latency_seconds_count{model_id="${modelId}"} ${totalRequests}\n`;

      // Errors
      metrics += `inference_errors_total{model_id="${modelId}",error_type="none"} 0\n`;

      // Confidence
      metrics += `prediction_confidence_avg{model_id="${modelId}"} ${avgConfidence}\n`;

      // Drift
      metrics += `drift_alerts_total{model_id="${modelId}"} ${driftAlerts}\n`;
      
      metrics += '\n';
    }

    return metrics;
  }
}
