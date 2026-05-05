'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import axios from 'axios';

interface ModelStats {
  modelId: string;
  latestVersion: string;
  totalInferences: number;
  averageConfidence: number;
  lastUpdated: string;
}

interface PredictionStats {
  totalPredictions: number;
  averageConfidence: number;
  driftDetectedCount: number;
  errorRate: number;
  averageLatency: number;
}

interface DriftAlert {
  id: string;
  reportId: string;
  modelId: string;
  driftDetected: boolean;
  driftAlerts: Record<string, any>;
  createdAt: string;
}

export default function MonitoringDashboard() {
  const [selectedModel, setSelectedModel] = useState('diabetes_pred');
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const models = [
    'diabetes_pred',
    'heart_pred',
    'kidney_pred',
    'liver_pred',
    'stroke_pred',
    'thyroid_pred',
    'autism_pred',
  ];

  useEffect(() => {
    fetchData();
  }, [selectedModel]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [modelInfoRes, statsRes, driftRes] = await Promise.all([
        axios.get(`/api/logs/model/info?modelId=${selectedModel}`),
        axios.get(`/api/logs/statistics?modelId=${selectedModel}`),
        axios.get(`/api/logs/drift-alerts?modelId=${selectedModel}&limit=10`),
      ]);

      if (modelInfoRes.data.success) {
        setModelStats(modelInfoRes.data.info);
      }
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
      if (driftRes.data.success) {
        setDriftAlerts(driftRes.data.alerts || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error fetching monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sample confidence distribution data
  const confidenceData = [
    { range: '0-20%', count: 5 },
    { range: '20-40%', count: 12 },
    { range: '40-60%', count: 28 },
    { range: '60-80%', count: 65 },
    { range: '80-100%', count: 190 },
  ];

  const chartColors = ['#8b5cf6', '#6366f1', '#3b82f6', '#10b981', '#ef4444'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔍 MLOps Monitoring Dashboard</h1>
          <p className="text-slate-400">Real-time prediction tracking, drift detection, and model health</p>
        </div>

        {/* Model Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Select Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg hover:border-slate-500 transition"
          >
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200">
            Error: {error}
          </div>
        )}

        {/* Stats Grid */}
        {modelStats && stats && !loading && (
          <>
            {/* Model Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Total Inferences */}
              <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700/30 rounded-lg p-6">
                <p className="text-slate-400 text-sm font-medium mb-2">Total Inferences</p>
                <p className="text-3xl font-bold text-blue-400">{stats.totalPredictions}</p>
                <p className="text-xs text-slate-500 mt-2">All time</p>
              </div>

              {/* Average Confidence */}
              <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-700/30 rounded-lg p-6">
                <p className="text-slate-400 text-sm font-medium mb-2">Avg Confidence</p>
                <p className="text-3xl font-bold text-green-400">
                  {(stats.averageConfidence * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-2">Model reliability</p>
              </div>

              {/* Drift Alerts */}
              <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/20 border border-orange-700/30 rounded-lg p-6">
                <p className="text-slate-400 text-sm font-medium mb-2">Drift Alerts</p>
                <p className="text-3xl font-bold text-orange-400">{stats.driftDetectedCount}</p>
                <p className="text-xs text-slate-500 mt-2">Recent detections</p>
              </div>

              {/* Avg Latency */}
              <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-700/30 rounded-lg p-6">
                <p className="text-slate-400 text-sm font-medium mb-2">Avg Latency</p>
                <p className="text-3xl font-bold text-purple-400">
                  {stats.averageLatency.toFixed(0)}ms
                </p>
                <p className="text-xs text-slate-500 mt-2">Inference time</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Confidence Distribution */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur">
                <h2 className="text-lg font-semibold text-white mb-4">Confidence Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={confidenceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="range" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                      }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Model Info */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur">
                <h2 className="text-lg font-semibold text-white mb-4">Model Information</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-slate-400 text-sm">Model Name</p>
                    <p className="text-white font-mono">{modelStats.modelId}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Latest Version</p>
                    <p className="text-white font-mono">{modelStats.latestVersion}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Last Updated</p>
                    <p className="text-slate-300 text-sm">
                      {new Date(modelStats.lastUpdated).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={fetchData}
                    className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Drift Alerts Table */}
            {driftAlerts.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Drift Alerts</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-slate-300">
                    <thead className="border-b border-slate-700">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold">Time</th>
                        <th className="text-left py-3 px-4 font-semibold">Report ID</th>
                        <th className="text-left py-3 px-4 font-semibold">Severity</th>
                        <th className="text-left py-3 px-4 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driftAlerts.map((alert) => (
                        <tr key={alert.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                          <td className="py-3 px-4">
                            {new Date(alert.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">{alert.reportId.slice(0, 8)}...</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-orange-900/40 text-orange-300 rounded text-xs font-medium">
                              ⚠️ Warning
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400">
                            Feature or distribution drift detected
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No Data State */}
            {driftAlerts.length === 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center backdrop-blur">
                <p className="text-slate-400">✅ No drift alerts detected - model is stable!</p>
              </div>
            )}
          </>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
            <p className="text-slate-400 mt-4">Loading monitoring data...</p>
          </div>
        )}
      </div>
    </div>
  );
}
