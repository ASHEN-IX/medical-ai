import axios from "axios";
import { apiClient } from "@/lib/apiClient";

export type ReportType = "auto" | "diabetes" | "heart" | "kidney" | "stroke" | "autism" | "mixed";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PriorityLevel = "LOW" | "MEDIUM" | "URGENT";

export interface AnalyzeReportPayload {
  report_type: ReportType;
  features: Record<string, number | string | null | undefined>;
  raw_text?: string;
  include_explanation?: boolean;
  symptoms?: string[];
  image?: string;
}

export interface ProcessReportResponse {
  success: boolean;
  report_type: string;
  features: Record<string, number | string | null | undefined>;
  confidence_scores: Record<string, number>;
  raw_text: string;
  metadata: {
    processing_time_ms: number;
    timestamp: string;
    extraction_method: string;
  };
}

export interface GatewayModelResult {
  risk: RiskLevel;
  confidence: number;
}

export interface GatewayModelDetail extends GatewayModelResult {
  source?: string;
  success?: boolean;
  error?: string | null;
  autism_detected?: boolean;
  raw_response?: Record<string, unknown> | null;
}

export interface RiskAssessment {
  overall_risk: RiskLevel;
  priority: PriorityLevel;
  final_decision: string;
  rationale: string[];
}

export interface KnowledgeGraphInsights {
  diseases: string[];
  symptoms: string[];
  risk_factors: string[];
  complications: string[];
  treatments: string[];
  connections: string[];
}

export interface GatewayAnalyzeResponse {
  success: boolean;
  request_id: string;
  inputs: {
    report_type: ReportType;
    include_explanation: boolean;
    symptoms: string[];
    has_image: boolean;
    has_raw_text: boolean;
  };
  extracted_features: Record<string, unknown>;
  model_outputs: Record<string, GatewayModelDetail>;
  rag_context: string[];
  kg_insights: KnowledgeGraphInsights;
  risk_assessment: RiskAssessment;
  llm_explanation_text: string;
  final_decision: string;
  selected_models: string[];
  results: Record<string, GatewayModelResult>;
  final_assessment: {
    overall_risk: RiskLevel;
    priority: PriorityLevel;
  };
  reasoning: string[];
  llm_explanation?: {
    summary: string;
    explanation: string[];
    risk_interpretation: { level: RiskLevel; meaning: string };
    recommendations: string[];
    safety_note: string;
  } | null;
  metadata: {
    processing_time_ms: number;
    timestamp: string;
  };
}

export interface AnalysisHistoryItem {
  id: string;
  createdAt: string;
  testName: string;
  healthScore: number | null;
  riskLevel: RiskLevel;
  keyFindings: string[];
  aiInsights: string | null;
  status: string;
  selectedModels: string[];
  features: Record<string, number | string | null | undefined>;
  symptoms: string[];
  results: Record<string, GatewayModelResult>;
  doctorReviews?: DoctorReview[];
  request?: AnalyzeReportPayload;
  response?: GatewayAnalyzeResponse;
}

export interface DoctorReview {
  id: string;
  doctorId: string;
  diagnosis?: string;
  notes?: string;
  recommendations: string[];
  prescription?: string;
  aiApproved?: boolean;
  aiCorrection?: string;
  createdAt: string;
  doctor?: { id: string; name: string; doctorProfile?: { specialty: string } };
}

export interface DoctorRequest {
  id: string;
  patientId: string;
  doctorId: string | null;
  analysisId: string;
  specialty: string | null;
  urgency: string;
  status: string;
  notes: string | null;
  createdAt: string;
  doctor?: { id: string; name: string; email: string; doctorProfile?: { specialty: string } };
  analysis?: AnalysisHistoryItem;
  patient?: { id: string; name: string; email: string; age?: number; gender?: string };
}

export interface HealthTimeline {
  metrics: Record<string, Array<{ value: number; date: string }>>;
  analyses: Array<{
    id: string;
    healthScore: number | null;
    riskLevel: string;
    createdAt: string;
    testName: string;
  }>;
  insights: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ManualModelRunResponse {
  success: boolean;
  results: Record<string, { risk: string; confidence: number }>;
  details?: Record<string, unknown>;
  failures?: Record<string, string>;
}

const getAiGatewayUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8001`;
  }
  return process.env.NEXT_PUBLIC_AI_GATEWAY_URL || "http://localhost:8001";
};

const aiGatewayApi = axios.create({
  baseURL: getAiGatewayUrl(),
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

aiGatewayApi.interceptors.request.use(
  (config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

function normalizeError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") return new Error("The AI service took too long. Please try again.");
    const status = error.response?.status;
    const detail = error.response?.data as any;
    const msg = typeof detail?.detail === "string" ? detail.detail : detail?.detail?.message || detail?.message;
    if (status === 400) return new Error(msg || "Invalid input.");
    if (status === 422) return new Error(msg || "Request could not be processed.");
    if (status && status >= 500) return new Error("Service temporarily unavailable.");
    return new Error(msg || "Request failed.");
  }
  return error instanceof Error ? error : new Error("Unexpected error.");
}

// --- AI Gateway (direct to FastAPI) ---
export async function analyzeReportDirect(payload: AnalyzeReportPayload): Promise<GatewayAnalyzeResponse> {
  try {
    const { data } = await aiGatewayApi.post<GatewayAnalyzeResponse>("/api/v1/ai/analyze", payload);
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function processReportFile(file: File): Promise<ProcessReportResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await aiGatewayApi.post<ProcessReportResponse>("/api/v1/report/process", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function runManualModels(
  selectedModels: string[],
  payload: Partial<AnalyzeReportPayload>
): Promise<ManualModelRunResponse> {
  try {
    const { data } = await aiGatewayApi.post<ManualModelRunResponse>("/api/v1/ai/run-model", {
      selected_models: selectedModels,
      ...payload,
    });
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
}

// --- Staged Diagnosis (two-phase follow-up workflow) ---

export interface FollowUpQuestion {
  id: string;
  text: string;
  disease: string;
  category: string;
  reason: string;
  answer_type: "free_text" | "yes_no" | "scale" | "multiple_choice";
  options: string[];
  priority: number;
  kg_source?: string;
  rag_source?: string;
}

export interface PatientAnswer {
  question_id: string;
  answer: string;
}

export type SessionStage = "initial_analysis" | "follow_up_pending" | "answers_submitted" | "final_report_ready";

export interface StagedAnalyzeResponse {
  success: boolean;
  session_id: string;
  stage: SessionStage;
  report_type: string;
  selected_disease?: string;
  overall_risk: RiskLevel;
  confidence: number;
  model_outputs: Record<string, unknown>;
  needs_follow_up: boolean;
  follow_up_questions: FollowUpQuestion[];
  reasoning: string[];
  rag_context: string[];
  kg_insights: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface FetchQuestionsResponse {
  success: boolean;
  session_id: string;
  stage: SessionStage;
  selected_disease?: string;
  questions: FollowUpQuestion[];
  question_count: number;
}

export interface SubmitAnswersResponse {
  success: boolean;
  session_id: string;
  stage: SessionStage;
  enriched_features: Record<string, unknown>;
  feature_count: number;
  next_questions: FollowUpQuestion[];
  needs_more_questions: boolean;
}

export interface FinalReportResponse {
  success: boolean;
  session_id: string;
  stage: SessionStage;
  report_type: string;
  selected_disease?: string;
  updated_risk: RiskLevel;
  updated_confidence: number;
  model_outputs: Record<string, unknown>;
  rag_context: string[];
  kg_insights: Record<string, unknown>;
  evidence_summary: string[];
  missing_caveats: string[];
  recommendations: string[];
  llm_narrative: string;
  initial_vs_final: {
    initial_risk: RiskLevel;
    final_risk: RiskLevel;
    initial_confidence: number;
    final_confidence: number;
    risk_changed: boolean;
    confidence_delta: number;
  };
  safety_note: string;
  metadata: Record<string, unknown>;
}

export async function stagedAnalyze(payload: AnalyzeReportPayload): Promise<StagedAnalyzeResponse> {
  try {
    const { data } = await apiClient.post<StagedAnalyzeResponse>("/ai/diagnosis/analyze", payload);
    return data;
  } catch {
    try {
      const { data } = await aiGatewayApi.post<StagedAnalyzeResponse>("/api/v1/diagnosis/analyze", payload);
      return data;
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export async function fetchFollowUpQuestions(sessionId: string): Promise<FetchQuestionsResponse> {
  try {
    const { data } = await apiClient.post<FetchQuestionsResponse>("/ai/diagnosis/questions", { session_id: sessionId });
    return data;
  } catch {
    try {
      const { data } = await aiGatewayApi.post<FetchQuestionsResponse>("/api/v1/diagnosis/questions", { session_id: sessionId });
      return data;
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export async function submitFollowUpAnswers(sessionId: string, answers: PatientAnswer[]): Promise<SubmitAnswersResponse> {
  try {
    const { data } = await apiClient.post<SubmitAnswersResponse>("/ai/diagnosis/answers", { session_id: sessionId, answers });
    return data;
  } catch {
    try {
      const { data } = await aiGatewayApi.post<SubmitAnswersResponse>("/api/v1/diagnosis/answers", { session_id: sessionId, answers });
      return data;
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export async function generateFinalReport(sessionId: string): Promise<FinalReportResponse> {
  try {
    const { data } = await apiClient.post<FinalReportResponse>("/ai/diagnosis/final-report", { session_id: sessionId });
    return data;
  } catch {
    try {
      const { data } = await aiGatewayApi.post<FinalReportResponse>("/api/v1/diagnosis/final-report", { session_id: sessionId });
      return data;
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

// --- Backend API (NestJS via apiClient) ---

export async function analyzeReport(payload: AnalyzeReportPayload): Promise<GatewayAnalyzeResponse> {
  try {
    const { data } = await apiClient.post<GatewayAnalyzeResponse>("/ai/analyze", payload);
    return data;
  } catch {
    return analyzeReportDirect(payload);
  }
}

export async function fetchAnalyses(): Promise<AnalysisHistoryItem[]> {
  try {
    const { data } = await apiClient.get<AnalysisHistoryItem[]>("/analyses/my-analyses");
    return data;
  } catch {
    return [];
  }
}

export async function fetchAnalysisById(id: string): Promise<AnalysisHistoryItem | null> {
  try {
    const { data } = await apiClient.get<AnalysisHistoryItem>(`/analyses/${id}`);
    return data;
  } catch {
    return null;
  }
}

export async function fetchHealthTimeline(): Promise<HealthTimeline | null> {
  try {
    const { data } = await apiClient.get<HealthTimeline>("/ai/health-timeline");
    return data;
  } catch {
    return null;
  }
}

// Doctor requests
export async function createDoctorRequest(body: {
  analysisId: string;
  specialty?: string;
  urgency?: string;
  notes?: string;
}): Promise<DoctorRequest> {
  const { data } = await apiClient.post<DoctorRequest>("/doctor-requests", body);
  return data;
}

export async function fetchMyDoctorRequests(): Promise<DoctorRequest[]> {
  const { data } = await apiClient.get<DoctorRequest[]>("/doctor-requests/my-requests");
  return data;
}

export async function fetchDoctorQueue(): Promise<DoctorRequest[]> {
  const { data } = await apiClient.get<DoctorRequest[]>("/doctor-requests/queue");
  return data;
}

export async function claimDoctorRequest(id: string): Promise<DoctorRequest> {
  const { data } = await apiClient.patch<DoctorRequest>(`/doctor-requests/${id}/claim`);
  return data;
}

// Doctor reviews
export async function createDoctorReview(body: {
  analysisId: string;
  diagnosis?: string;
  notes?: string;
  recommendations?: string[];
  prescription?: string;
  aiApproved?: boolean;
  aiCorrection?: string;
}): Promise<DoctorReview> {
  const { data } = await apiClient.post<DoctorReview>("/doctor-reviews", body);
  return data;
}

export async function fetchReviewsForAnalysis(analysisId: string): Promise<DoctorReview[]> {
  const { data } = await apiClient.get<DoctorReview[]>(`/doctor-reviews/analysis/${analysisId}`);
  return data;
}

export async function fetchFeedbackStats() {
  const { data } = await apiClient.get("/doctor-reviews/feedback-stats");
  return data;
}

// Messages
export async function sendMessage(body: {
  conversationId?: string;
  receiverId?: string;
  content: string;
  type?: string;
  fileUrl?: string;
}) {
  const { data } = await apiClient.post("/messages", body);
  return data;
}

export async function fetchConversations() {
  const { data } = await apiClient.get("/messages/conversations");
  return data;
}

export async function fetchConversationMessages(conversationId: string) {
  const { data } = await apiClient.get(`/messages/conversation/${conversationId}/messages`);
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  try {
    const { data } = await apiClient.get<{ unreadCount: number }>("/messages/unread-count");
    return data.unreadCount;
  } catch {
    return 0;
  }
}

export async function markConversationRead(conversationId: string) {
  const { data } = await apiClient.patch(`/messages/conversation/${conversationId}/read`);
  return data;
}

// AI Chat
export async function chatWithAI(
  message: string,
  analysisContext?: Record<string, unknown>,
  history?: ChatMessage[]
): Promise<{ response: string; sources: string[] }> {
  try {
    const { data } = await apiClient.post("/ai/chat", { message, analysis_context: analysisContext, history });
    return data;
  } catch {
    const { data } = await aiGatewayApi.post("/api/v1/chat", { message, analysis_context: analysisContext, history });
    return data;
  }
}

// Legacy compat
export async function fetchHistory(): Promise<AnalysisHistoryItem[]> {
  return fetchAnalyses();
}

export async function getReportById(id: string): Promise<AnalysisHistoryItem | null> {
  return fetchAnalysisById(id);
}

export async function saveAnalysisToHistory(
  request: AnalyzeReportPayload,
  response: GatewayAnalyzeResponse
): Promise<AnalysisHistoryItem> {
  return {
    id: response.request_id || `analysis_${Date.now()}`,
    createdAt: new Date().toISOString(),
    testName: request.report_type || "auto",
    healthScore: null,
    riskLevel: response.final_assessment?.overall_risk || "LOW",
    keyFindings: response.reasoning || [],
    aiInsights: response.llm_explanation_text || null,
    status: "COMPLETED",
    selectedModels: response.selected_models || [],
    features: request.features || {},
    symptoms: request.symptoms || [],
    results: response.results || {},
    request,
    response,
  };
}

// ============================================================
// NEW API FUNCTIONS — Healthcare Ecosystem Extension
// ============================================================

// --- Manual Tests ---
export async function fetchManualTestSchemas() {
  const { data } = await apiClient.get("/manual-tests/schemas");
  return data;
}

export async function fetchManualTestSchema(disease: string) {
  const { data } = await apiClient.get(`/manual-tests/schemas/${disease}`);
  return data;
}

export async function runManualTest(disease: string, inputData: Record<string, any>) {
  const { data } = await apiClient.post("/manual-tests/run", { disease, inputData });
  return data;
}

export async function fetchMyManualTests() {
  const { data } = await apiClient.get("/manual-tests/my-tests");
  return data;
}

// --- Case Assignments ---
export async function autoAssignSpecialist(body: {
  analysisId: string;
  disease: string;
  priority?: string;
  notes?: string;
}) {
  const { data } = await apiClient.post("/case-assignments/auto-assign", body);
  return data;
}

export async function fetchMyCases() {
  const { data } = await apiClient.get("/case-assignments/my-cases");
  return data;
}

export async function fetchCaseById(id: string) {
  const { data } = await apiClient.get(`/case-assignments/${id}`);
  return data;
}

// --- Appointments ---
export async function createAppointment(body: {
  doctorId: string;
  caseAssignmentId?: string;
  scheduledAt: string;
  durationMinutes?: number;
  type?: string;
  notes?: string;
}) {
  const { data } = await apiClient.post("/appointments", body);
  return data;
}

export async function fetchMyAppointments() {
  const { data } = await apiClient.get("/appointments/my-appointments");
  return data;
}

export async function cancelAppointment(id: string) {
  const { data } = await apiClient.patch(`/appointments/${id}/cancel`);
  return data;
}

export async function createTeleconsultation(appointmentId: string) {
  const { data } = await apiClient.post(`/appointments/${appointmentId}/teleconsultation`);
  return data;
}

export async function fetchTeleconsultation(roomId: string) {
  const { data } = await apiClient.get(`/appointments/teleconsultation/${roomId}`);
  return data;
}

// --- Alerts ---
export async function fetchAlerts(unreadOnly = false) {
  const { data } = await apiClient.get(`/alerts?unreadOnly=${unreadOnly}`);
  return data;
}

export async function fetchAlertUnreadCount(): Promise<number> {
  try {
    const { data } = await apiClient.get<{ unreadCount: number }>("/alerts/unread-count");
    return data.unreadCount;
  } catch {
    return 0;
  }
}

export async function markAlertRead(id: string) {
  const { data } = await apiClient.patch(`/alerts/${id}/read`);
  return data;
}

export async function dismissAlert(id: string) {
  const { data } = await apiClient.patch(`/alerts/${id}/dismiss`);
  return data;
}

export async function markAllAlertsRead() {
  const { data } = await apiClient.patch("/alerts/read-all");
  return data;
}

// --- Transportation ---
export async function bookTransportation(body: {
  appointmentId?: string;
  vehicleType?: string;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  destAddress: string;
  destLat?: number;
  destLng?: number;
  scheduledAt: string;
  notes?: string;
}) {
  const { data } = await apiClient.post("/transportation/book", body);
  return data;
}

export async function fetchMyTransportBookings() {
  const { data } = await apiClient.get("/transportation/my-bookings");
  return data;
}

export async function cancelTransportBooking(id: string) {
  const { data } = await apiClient.patch(`/transportation/${id}/cancel`);
  return data;
}

// --- Prescriptions & Medications ---
export async function fetchMyPrescriptions() {
  const { data } = await apiClient.get("/prescriptions/my-prescriptions");
  return data;
}

export async function createPrescription(body: {
  patientId: string;
  caseAssignmentId?: string;
  diagnosis?: string;
  notes?: string;
  medications: Array<{
    name: string; dosage: string; frequency: string;
    route?: string; startDate: string; endDate?: string;
    sideEffects?: string[]; instructions?: string;
  }>;
}) {
  const { data } = await apiClient.post("/prescriptions", body);
  return data;
}

export async function fetchUpcomingReminders() {
  const { data } = await apiClient.get("/prescriptions/reminders");
  return data;
}

export async function markReminderTaken(id: string) {
  const { data } = await apiClient.patch(`/prescriptions/reminders/${id}/taken`);
  return data;
}

export async function markReminderSkipped(id: string, notes?: string) {
  const { data } = await apiClient.patch(`/prescriptions/reminders/${id}/skipped`, { notes });
  return data;
}

// --- Prevention Plans ---
export async function generatePreventionPlan() {
  const { data } = await apiClient.post("/prevention-plans/generate");
  return data;
}

export async function fetchActivePreventionPlan() {
  const { data } = await apiClient.get("/prevention-plans/active");
  return data;
}

export async function fetchAllPreventionPlans() {
  const { data } = await apiClient.get("/prevention-plans");
  return data;
}

// --- Consultation History ---
export async function fetchConsultationTimeline() {
  const { data } = await apiClient.get("/consultation-history/timeline");
  return data;
}


// --- Staged Diagnosis ---
export async function startStagedDiagnosis(body: { reportId?: string; disease?: string; features?: any; symptoms?: string[] }) {
  const { data } = await apiClient.post("/staged-diagnosis/start", body);
  return data;
}

export async function fetchStagedDiagnosis(id: string) {
  const { data } = await apiClient.get(`/staged-diagnosis/${id}`);
  return data;
}

export async function submitStagedAnswers(id: string, answers: any[]) {
  const { data } = await apiClient.post(`/staged-diagnosis/${id}/answers`, { answers });
  return data;
}

export async function finalizeStagedDiagnosis(id: string) {
  const { data } = await apiClient.post(`/staged-diagnosis/${id}/finalize`);
  return data;
}
