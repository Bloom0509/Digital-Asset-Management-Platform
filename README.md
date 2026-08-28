# Digital Asset Management + AI

A multi-tenant digital asset management platform with React, Django REST Framework, PostgreSQL, Redis, S3-compatible storage, pgvector, and AI services.

## Project layout

- `frontend/` React + TypeScript application
- `backend/` Django + Django REST Framework API
- `infra/` local PostgreSQL, Redis, and MinIO services
- `docs/` architecture and delivery notes

## Development order

1. Tenant and user foundations
2. Asset metadata and upload workflow
3. S3-compatible storage and APIs
4. Collections, tags, and search
5. AI analysis, embeddings, semantic search, RAG, and agents

## Local services

From `infra/`, run `docker compose up -d` to start PostgreSQL with pgvector, Redis, and MinIO.

## Frontend

```powershell
cd frontend
npm run dev
```

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
