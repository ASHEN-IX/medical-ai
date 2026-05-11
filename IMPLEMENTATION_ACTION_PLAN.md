# MedAI Nexus — Implementation Action Plan

This document details the prioritized implementation plan to complete the partially-implemented features, fix integration/blockers, and deliver the MVP. It includes scope, concrete steps, files to change, database migration notes, test and rollout instructions, and time estimates.

---

## 1. Goals
- Stabilize backend so `medical-api` builds cleanly and services start.
- Complete critical MVP features (Medications UI, Messages UI, Teleconsultation video, Real-time updates, Medication reminders scheduler, Specialist assignment LLM, full Prevention Plans).
- Provide clear, small, testable deliverables with acceptance criteria.

---

## 2. Current snapshot (condensed)
- Backend: controllers wired to services but many services reference missing DB fields or return stubs.
- AI service (FastAPI): Groq integration present; `specialist_assignment` route added and syntax-checked.
- Frontend: many pages scaffolded; Medications & Messages UI incomplete; Teleconsultation UI exists but streaming not connected.
- Integration: Frontend ↔ Backend mostly works; Backend ↔ AI mostly works but needs robust error handling; WebSocket real-time flow not fully wired for alerts/messages.

---

## 3. Prioritized Implementation Roadmap (High-level)
1. Immediate Stability (compile + smoke tests) — 1-2 days
2. Messaging & WebSockets (realtime) — 3-4 days
3. Medications & Reminder Scheduler — 3-4 days
4. Teleconsultation streaming (WebRTC/Jitsi) — 2-3 days
5. Specialist LLM finalization & tests — 1-2 days
6. Prevention Plans: complete remaining diseases — 1-2 days
7. Health metrics ingestion + monitoring — 1-2 days
8. End-to-end QA, tests, and Docker compose smoke runs — 1-2 days

Total ~2–3 weeks (parallelize tasks where possible).

---

## 4. Immediate Stability Task (Task A) — Make `medical-api` compile
Objective: Apply minimal, non-invasive code fixes so the backend TypeScript build succeeds without DB migrations. This enables live integration testing quickly.

Actions (concrete edits):
- Update `src/modules/messages/messages.service.ts`:
  - Ensure created `message` payload includes required `receiverId` (derive from conversation participants or from provided `receiverId`).
- Update `src/modules/appointments/appointments.service.ts`:
  - Replace alert `type` strings not defined in Prisma `AlertType` with existing enum values (e.g., map `APPOINTMENT_SCHEDULED` → `CASE_UPDATE` or `DOCTOR_MESSAGE`), or add a mapping function.
  - Remove references to `reminderSent` and instead rely on `MedicationReminder` or `Alert` records; change find/update filters accordingly.
  - Stop selecting non-existent `phone` on `User` (remove `phone` from `select` statements).
- Update `src/modules/dynamic-questions/dynamic-questions.service.ts`:
  - If `DynamicQuestion` model is not present in `prisma/schema.prisma`, temporarily persist to `ConsultationHistoryEvent` or `ManualTest.results` to avoid compile-time Prisma accessors; mark TODO to add model (schema-first approach later).
  - Fix implicit `any` parameters (add types for `q` in filters/map operations).
- Minor TS adjustments: fix uninitialized property declarations (e.g., add definite assignment or initializers where required).

Files to touch (minimal):
- `medical-api/src/modules/messages/messages.service.ts`
- `medical-api/src/modules/appointments/appointments.service.ts`
- `medical-api/src/modules/dynamic-questions/dynamic-questions.service.ts`
- `medical-api/src/modules/case-assignments/case-assignments.service.ts` (if calling LLM endpoint formatting needs small fixes)

Acceptance criteria:
- `cd medical-api && npm run build` completes with zero TypeScript errors.
- Basic smoke endpoints (GET `/health`) start without runtime errors when started.

Estimated effort: 4–8 hours.

---

## 5. Schema-first Task (Task B) — Add missing DB fields/models (longer, optional)
Objective: Align the Prisma schema with desired domain models (DynamicQuestion, Appointment.reminderSent, User.phone, Analysis.confidence, new AlertType values) and apply migrations.

Steps:
1. Update `prisma/schema.prisma` to add:
   - `model DynamicQuestion { ... }` (fields: id, caseAssignmentId, questionText, questionType, options Json?, responses Json?, answered Boolean, answeredAt DateTime?, createdAt, updatedAt)
   - `Appointment.reminderSent Boolean?` if required
   - `User.phone String?`
   - `Analysis.confidence Float?`
   - Extend `enum AlertType` with the appointment-related values if desired
2. Run `npx prisma migrate dev --name add_dynamic_questions_and_fields` and verify local DB.
3. Update affected TypeScript services to use the new models (remove previous fallbacks).

Risks: Data migration and downstream code needs careful testing. Work with a DB backup for production.

Estimated effort: 1–2 days.

---

## 6. Messaging & Realtime (Task 2)
Objective: Make doctor-patient chat fully functional and add realtime notifications via WebSocket.

Actions:
- Ensure `MessagesService.sendMessage()` always creates or resolves a conversation and sets `receiverId`.
- Verify `CommunicationsGateway` maintains `userSockets` map and correctly emits `newMessage` and `newAlert` events.
- Frontend: complete `messages` page to handle connecting to socket (via `SocketContext`), displaying messages, and sending (already scaffolded — finish handlers and error flows).
- Add server-side events for alerts (from NotificationService) to emit `newAlert` to connected users.

Files:
- `medical-api/src/modules/messages/messages.service.ts`
- `medical-api/src/modules/communications/communications.gateway.ts`
- `medical-web/src/app/(dashboard)/messages/*`

Tests/Acceptance:
- Send message via API or UI → receiver receives realtime event and message is persisted.

Estimated effort: 2–4 days.

---

## 7. Medication Reminders & Scheduler (Task 3)
Objective: Implement scheduler to send reminder alerts and track adherence.

Approach:
- Use Bull or a lightweight cron within the Nest app to poll `MedicationReminder` table for upcoming reminders and enqueue/send alerts.
- NotificationsService will create `Alert` records and (later) integrate with SendGrid/Twilio (deferred per your instruction).

Files:
- `medical-api/src/modules/medications/medication-reminders.service.ts`
- Add Bull module config (if using Bull): `@nestjs/bull` and `redis` env.

Acceptance:
- Creating a reminder results in an `Alert` within configured horizon and the UI displays it.

Estimated: 2–3 days.

---

## 8. Teleconsultation Streaming (Task 4)
Objective: Wire video streaming for teleconsultation rooms (WebRTC or Jitsi integration).

Quick options:
- Integrate Jitsi Meet iframe: fastest (2 days). Pros: less infra. Cons: external dependency.
- WebRTC peer-to-peer using signaling via `CommunicationsGateway`: more control (3–4 days).

Files:
- `medical-web/src/components/teleconsultation/*` (implement Jitsi iframe or WebRTC hooks)
- `medical-api/src/modules/communications/communications.gateway.ts` (signaling handlers already present)

Acceptance:
- Two users join room → see each other's video/audio.

---

## 9. Specialist Assignment LLM finalization (Task 5)
Objective: Harden LLM ranking for specialist assignment (validate JSON schema, add retries, bounded timeouts, tests).

Actions:
- Validate `specialist_assignment` output schema (ordered IDs, confidence).
- Add request timeouts and graceful fallback to heuristic ranking.
- Add unit tests for `rank_specialists_with_llm` and an integration test against a mocked Groq client.

Files:
- `ai-service/app/api/routes/specialist_assignment.py`
- `medical-api/src/modules/case-assignments/case-assignments.service.ts`

Estimated: 1–2 days.

---

## 10. Prevention Plans (Task 6)
Objective: Expand `PreventionPlansService` to support remaining diseases and integrate with UI.

Actions:
- Add templates for remaining diseases to `PreventionPlansService`.
- Ensure fallback to generic templates if AI fails.
- Frontend: wire prevention plan page to fetch and display plan cards.

Estimated: 1–2 days.

---

## 11. Testing & CI
- Unit tests for key services (`messages`, `appointments`, `medications`, `case-assignments`).
- Integration/E2E tests to cover flows: upload → analysis → assign → appointment → teleconsultation.
- Smoke test checklist (post-build):
  ```bash
  # from repo root
  cd medical-api && npm run build
  cd ../ai-service && /path/to/venv/bin/python -m py_compile app/main.py
  cd ../medical-web && npm run type-check
  # start services
  docker compose up --build -d
  # run simple health checks
  curl -sS http://localhost:8001/api/v1/health
  curl -sS http://localhost:4000/health
  curl -sS http://localhost:3000
  ```

---

## 12. Rollout & Checkpoints
- Checkpoint 1 (Day 1): Backend compiles and health endpoints respond.
- Checkpoint 2 (Day 3): Messaging real-time + Medications UI basic flows.
- Checkpoint 3 (Day 7): Reminder scheduler + Teleconsultation streaming.
- Final: All features in MVP list implemented and end-to-end smoke tests green.

---

## 13. Risks & Mitigations
- DB migrations can be disruptive: always run migrations locally and keep rollbacks/migrations history.
- LLM external key (Groq/OpenAI) required for full behavior: provide a test key or use deterministic fallback for CI.
- Teleconsultation streaming depends on browser capabilities and TURN servers; for P2P flows add TURN/STUN in production.

---

## 14. Next immediate steps I will execute (if you approve)
1. Apply the minimal code fixes described in **Section 4** to make `medical-api` buildable (Task A).
2. Run `npm run build` and report results.
3. If green, start implementing messaging/WebSocket fixes.

If you approve, I will proceed with step 1 now and push the code changes.

---

*Prepared by Copilot — I will execute changes after your confirmation.*