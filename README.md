# Digital Asset Management System + AI

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
Copy-Item .env.example .env
# Set OPENAI_API_KEY in backend/.env before requesting AI suggestions.
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## AI-assisted asset creation

When a user enters an asset name and type in the custom asset form, the frontend requests AI suggestions from the authenticated backend. The configured OpenAI model generates a suggested filename, alt text, caption, up to five tags, and three original doodle concepts. Users can review and apply the suggestions; a selected doodle can be used as artwork for the asset.

The AI request uses the asset name, type, file extension, and text context supplied by the form. It does not upload or inspect the actual asset file. The backend sanitizes returned SVG drawings to allow only supported vector shapes and attributes before sending them to the frontend.

The endpoint is `POST /api/ai/metadata/` and requires authentication. Its JSON request can include `asset_name`, `asset_type`, `file_extension`, and `content_context`. The response returns the generated fields under `suggestions`.

Configure `OPENAI_API_KEY` in `backend/.env` to enable this feature. `AI_MODEL` is optional and defaults to `gpt-4o-mini`; set it to another model supported by your OpenAI project if needed. AI suggestions are unavailable when the key is missing or the provider request fails.
