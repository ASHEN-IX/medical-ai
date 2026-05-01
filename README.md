# MedAI Nexus - Production-Grade AI Healthcare Platform

**Status:** Integrated local AI prototype  
**Date:** May 1, 2026  
**Team:** 4 parallel developers (Frontend, Backend, AI, Data)

## 🎯 Project Vision

MedAI Nexus is an enterprise-grade AI-powered medical analysis platform that:

- 📄 **Accepts** medical reports, imaging, and lab results
- 🤖 **Processes** documents through intelligent ML pipelines
- 🧠 **Analyzes** using trained disease detection models + AI Gateway routing
- 📊 **Provides** diagnostic insights with confidence metrics
- 📈 **Recommends** treatments backed by clinical evidence

## Integrated AI Models

The current AI service includes these disease detection integrations:

- **Diabetes detection** using a scikit-learn Decision Tree model trained in the diabetes notebook/Gradio workflow.
- **Autism survey prediction** using the existing tabular autism model.
- **Autism image/DL detection** route support is present, but the `.h5` model file must exist before it can load.
- **Kidney disease prediction** using the existing kidney model artifacts.

### Diabetes Integration

The diabetes model is stored at:

```text
ai-service/models/diabetes/diabetes_decision_tree.joblib
```

It is exposed through:

```text
POST /api/v1/diabetes/predict
POST /api/v1/ai/analyze
```

The frontend diabetes intake uses the same 8 fields as the original Gradio notebook:

```text
Pregnancies
Glucose
BloodPressure
SkinThickness
Insulin
BMI
DiabetesPedigreeFunction
Age
```

### Autism Integration

The autism backend routes are:

```text
POST /api/v1/autism-pred/predict
GET  /api/v1/autism-pred/categories
POST /api/v1/autism-dl/predict
```

The autism model artifacts are expected under:

```text
ai-service/models/autism-prediction/best-model-autism.pkl
ai-service/models/autism-prediction/encoders.pkl
ai-service/models/autism-dl/autism-dl.h5
ai-service/models/autism-dl/final_model.h5
```

If the autism DL `.h5` file is missing, the health endpoint reports the service as `degraded`, but diabetes and other loaded models can still run.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                         │
│  Dashboard → Upload → Results View                          │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend (NestJS)                                           │
│  API Gateway → Orchestrator → Database                      │
└──────┬──────────────────────┬───────────────────────────────┘
       │ REST                 │ SQL
       ▼                      ▼
   ┌────────────────┐  ┌──────────────┐
   │ AI Service     │  │ PostgreSQL   │
   │ (Python)       │  │ (Prisma)     │
   │                │  └──────────────┘
   ├─ ML Inference │
   ├─ RAG System   │
   ├─ Knowledge GW │
   └─ LLM Orche.   │
        │
    ┌───┼────┐
    ▼   ▼    ▼
  Vector  Neo4j  LLM
  DB      Graph  (OpenAI)
```

**Full architectural details:** [ARCHITECTURE.md](./ARCHITECTURE.md)

## 📦 Repository Structure

```
medical-ai/
├── ARCHITECTURE.md          ← Complete system design
├── README.md               ← This file
├── DEVELOPMENT.md          ← Developer setup guide
├── docker-compose.yml      ← Local dev environment
│
├── medical-web/            ← Frontend (Next.js)
│   └── [See medical-web/README.md]
│
├── medical-api/            ← Backend (NestJS)
│   └── [See medical-api/README.md]
│
├── ai-service/             ← AI Service (Python FastAPI)
│   └── [See ai-service/README.md]
│
├── infrastructure/         ← DevOps & deployment
│   ├── docker/
│   └── scripts/
│
└── shared/                 ← Shared types & constants
    ├── types/
    └── constants/
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- Python 3.10+ (for local AI development)
- Git

### Start Local Environment With Docker
```bash
# Clone the repository
git clone <repo-url>
cd medical-ai

# Copy example environment
cp .env.example .env.local

# Start all services with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

**Services will be available at:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- AI Service: http://localhost:8001
- Neo4j Browser: http://localhost:7474
- PostgreSQL: localhost:5432

### Start Current Local Frontend + AI Service

For the current local diabetes integration, the verified development setup is:

```powershell
# Terminal 1 - AI service
cd "D:\Education\Esprit\4 IoSyS\2éme Semester\Machine Learning__4IoSyS1\1. Projet\medical-ai\ai-service"
$env:PYTHONPATH="D:\Education\Esprit\4 IoSyS\2éme Semester\Machine Learning__4IoSyS1\1. Projet\medical-ai\ai-service"
& "..\..\Data Preparation - Copie\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2 - Frontend
cd "D:\Education\Esprit\4 IoSyS\2éme Semester\Machine Learning__4IoSyS1\1. Projet\medical-ai\medical-web"
npm install
npm run dev
```

Local URLs:

- Frontend: http://localhost:3000
- Diabetes intake page: http://localhost:3000/upload
- AI service health: http://localhost:8000/api/v1/health
- Diabetes API: http://localhost:8000/api/v1/diabetes/predict
- AI Gateway: http://localhost:8000/api/v1/ai/analyze

**[Full setup guide: DEVELOPMENT.md](./DEVELOPMENT.md)**

## 📋 Tech Stack

### Frontend
- **Framework:** Next.js 14+ with TypeScript
- **Styling:** TailwindCSS
- **State:** React Query + Context API
- **Form Validation:** zod
- **HTTP Client:** axios

### Backend
- **Framework:** NestJS with TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL 15
- **Auth:** JWT
- **Validation:** class-validator

### AI Intelligence
- **Server:** Python FastAPI
- **ML Frameworks:** PyTorch, scikit-learn
- **Integrated models:** Diabetes Decision Tree, autism survey model, autism DL route, kidney disease model
- **LLM:** LangChain + OpenAI/LLaMA
- **RAG:** FAISS / Chroma
- **Graph DB:** Neo4j
- **Processing:** OCR, NLP, feature extraction

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **Orchestration:** Kubernetes (optional)
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana
- **Logging:** ELK Stack

## 🎯 Development Phases

### ✅ Phase 1: Foundation (Weeks 1-3)
- Repository & infrastructure setup
- Database schema design
- Service communication skeleton

### Phase 2: Core Features (Weeks 4-8)
- Authentication & user management
- File upload & report management
- AI pipeline foundation

### ✅ Phase 3: AI Intelligence (Weeks 9-14)
- ML model integration
- RAG system
- LLM orchestration

### Phase 4: Frontend (Weeks 15-18)
- Dashboard & analysis views
- Real-time updates

### Phase 5: Production (Weeks 19-22)
- Testing, security, monitoring
- Production deployment

## 🧑‍💻 Team Structure

### Frontend Developer
- Builds Next.js dashboard
- Handles UI/UX in medical-web/
- **Doesn't** write backend code or AI logic

### Backend Developer
- Builds NestJS API gateway
- Manages authentication, databases
- Orchestrates calls to AI service
- **Doesn't** write AI models or ML code

### AI Engineer
- Builds Python FastAPI service
- ML model inference, RAG, LLM integration
- Knowledge graph queries
- **Doesn't** handle authentication or user management

### Data Engineer
- Designs database schemas
- Creates migration scripts
- Manages Neo4j knowledge graph
- Prepares training data & embeddings

## 📚 Key Documentation

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system design (reference)
2. **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Developer setup & workflow
3. **[medical-web/README.md](./medical-web/README.md)** - Frontend development
4. **[medical-api/README.md](./medical-api/README.md)** - Backend development
5. **[ai-service/README.md](./ai-service/README.md)** - AI service development

## 🔐 Security Considerations

- ✅ JWT authentication on all protected endpoints
- ✅ HTTPS enforced in production
- ✅ Role-based access control (RBAC)
- ✅ Input validation on all services
- ✅ Encryption at rest & in transit
- ✅ Rate limiting per user/endpoint
- ✅ HIPAA compliance roadmap

## 📊 Monitoring & Observability

- **Logs:** ELK Stack (Elasticsearch, Logstash, Kibana)
- **Metrics:** Prometheus + Grafana
- **Health:** Built-in health check endpoints
- **Tracing:** OpenTelemetry (optional)

## 🐛 Common Issues & Troubleshooting

See [DEVELOPMENT.md](./DEVELOPMENT.md#troubleshooting) for setup issues.

## 📞 Support & Communication

- **Architecture Questions:** Check ARCHITECTURE.md
- **Setup Issues:** See DEVELOPMENT.md
- **Code Standards:** See CONTRIBUTING.md (to be created)

## 📝 License

Internal use only - Healthcare proprietary.

## Git Workflow For Pull, Conflict Fix, And Push

Use this workflow before pushing your diabetes integration:

```bash
git status
git add README.md ai-service/README.md ai-service/app ai-service/models/diabetes medical-web/src/pages/UploadReportPage.tsx medical-web/package-lock.json medical-web/package.json
git commit -m "Integrate diabetes detection model"
git pull origin main --rebase
```

If Git reports conflicts:

```bash
git status
```

Open each conflicted file, remove conflict markers like:

```text
<<<<<<< HEAD
=======
>>>>>>> branch-name
```

Then continue:

```bash
git add <fixed-file>
git rebase --continue
```

After the rebase finishes:

```bash
git push origin main
```

If this is your first time pushing and Git asks for authentication, sign in with your GitHub account or use a GitHub personal access token.

## 🚦 Deployment

### Development
```bash
docker-compose up -d
```

### Staging/Production
```bash
# See infrastructure/kubernetes/ for K8s manifests
kubectl apply -f infrastructure/kubernetes/
```

## ✅ Sprint 0 Deliverables

- [x] System architecture design (4-layer microservices)
- [x] Repository structure (monorepo + independent services)
- [x] Service responsibilities (clear ownership)
- [x] Database design (PostgreSQL, Neo4j, FAISS)
- [x] Communication patterns (REST, SQL, Bolt)
- [x] API contracts (high-level endpoints)
- [x] AI pipeline design (12-stage flow)
- [x] Deployment strategy (Docker, K8s)
- [x] Design rules (loose coupling, stateless AI)
- [x] Development roadmap (22-week plan)

---

**Ready for Phase 1: Foundation Development**

For questions, refer to ARCHITECTURE.md or reach out to the tech lead.
