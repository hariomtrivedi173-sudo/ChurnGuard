# ChurnGuard
AI-Powered Customer Retention Intelligence Platform

ChurnGuard is an enterprise-grade customer churn prediction and retention platform. It leverages machine learning ensemble models (Voting Classifier, Random Forest, XGBoost, LightGBM) to forecast customer churn risks, explain predictive factors, and recommend targeted retention actions.

---

## Architecture

- **Frontend**: React, Vite, Tailwind CSS, served via high-performance Nginx Alpine container.
- **Backend**: FastAPI, Uvicorn, Python 3.13, Scikit-learn, XGBoost, LightGBM.
- **Database**: MongoDB Atlas (external managed replica set with TLS encryption).
- **Persistent Storage**: Named volumes for user avatars and generated audit reports.

---

## Local Development (Docker Compose)

### 1. Prerequisites
- Docker Engine & Docker Compose
- MongoDB Atlas cluster connection string

### 2. Environment Configuration
Copy example configuration templates to local `.env` files:
```bash
# Backend configuration
cp backend/.env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env
```
Fill in your MongoDB Atlas connection string (`MONGO_URI`), strong `JWT_SECRET_KEY`, and optional SMTP credentials in `backend/.env`.

> **Security Notice**: `.env` files contain sensitive credentials and are strictly excluded from version control via `.gitignore`. Never commit them to Git.

### 3. Launch Services
```bash
docker compose up -d --build
```

### 4. Service Access
- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## Production Deployment (Railway)

ChurnGuard is container-native and designed for production deployment on **Railway**:
- **Backend Service**: Deployed from `backend/Dockerfile` with Python 3.13 and ML model bundle.
- **Frontend Service**: Deployed from `frontend/Dockerfile` (Nginx Alpine) with `--build-arg VITE_API_URL=<production-backend-url>`.
- **Database**: Retains external MongoDB Atlas connection over TLS.
- **Persistent Storage**: Cloud persistent volumes attached to `/app/backend/uploads` (avatars) and `/app/reports` (PDF/CSV churn audit reports).
- **Secrets Management**: All production environment variables (`MONGO_URI`, `JWT_SECRET_KEY`, `SMTP_*`, `ALLOWED_ORIGINS`) must be configured directly within the Railway project settings, never in source code.
