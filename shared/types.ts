// Shared types and constants for MedAI Nexus
// This file is imported by both frontend and backend

export enum UserRole {
  ADMIN = 'ADMIN',
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  filePath: string;
  fileSize: number;
  status: ReportStatus;
  errorMessage?: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Prediction {
  id: string;
  reportId: string;
  userId: string;
  primaryDiagnosis: string;
  confidenceScore: number;
  secondaryDiagnoses?: Array<{ name: string; confidence: number }>;
  recommendedTreatments?: Array<{
    name: string;
    dosage?: string;
    duration?: string;
  }>;
  riskFactors?: string[];
  explanation?: string;
  modelVersion: string;
  processingTimeMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisRequest {
  reportId: string;
  priority?: 'NORMAL' | 'HIGH';
  notifyOnComplete?: boolean;
}

export interface AnalysisResponse {
  jobId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  result?: Prediction;
  errorMessage?: string;
  estimatedTimeMs?: number;
}

export interface ApiResponse<T> {
  statusCode: number;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_REFRESH: '/auth/refresh',
  
  // Users
  USERS_PROFILE: '/users/profile',
  USERS_UPDATE: '/users/profile',
  
  // Reports
  REPORTS_LIST: '/reports',
  REPORTS_UPLOAD: '/reports/upload',
  REPORTS_GET: (id: string) => `/reports/${id}`,
  REPORTS_DELETE: (id: string) => `/reports/${id}`,
  
  // Analysis
  ANALYSIS_START: (reportId: string) => `/analysis/${reportId}`,
  ANALYSIS_STATUS: (jobId: string) => `/analysis/${jobId}/status`,
  ANALYSIS_RESULTS: (jobId: string) => `/analysis/${jobId}/results`,
} as const;
