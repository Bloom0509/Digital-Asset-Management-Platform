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

The backend uses PostgreSQL. Redis and MinIO are available for local development through Docker Compose.

### Configure PostgreSQL

1. Copy the backend environment template and edit `backend/.env` with your local PostgreSQL credentials:

	```powershell
	Copy-Item backend/.env.example backend/.env
	```

	Set `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, and `POSTGRES_PORT`. For the local PostgreSQL installation, use the role and password configured in pgAdmin. Never commit `backend/.env`.

2. Start PostgreSQL. If you use the Compose PostgreSQL service, run this from the project root after setting the database variables in `backend/.env`:

	```powershell
	docker compose --env-file backend/.env -f infra/docker-compose.yml up -d postgres
	```

	Alternatively, start your installed PostgreSQL service. Don’t run both on the same port (5432) at once.

3. Apply the Django schema migrations:

	```powershell
	cd backend
	.\.venv\Scripts\python.exe manage.py migrate
	```

The migrations create the application tables in PostgreSQL; they do not copy records from another database. Uploaded files are stored separately under `backend/media` unless `DAM_MEDIA_ROOT` is configured.

## Frontend

```powershell
cd frontend
npm run dev
```

## Backend

```powershell
cd backend
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Before running the backend commands, configure the PostgreSQL variables in `.env` and ensure the PostgreSQL server is running and the configured database exists. `POSTGRES_PASSWORD` is required for the Compose PostgreSQL service. Set `OPENAI_API_KEY` in `.env` to enable AI suggestions.

## AI-assisted asset creation

When a user enters an asset name and type in the custom asset form, the frontend requests AI suggestions from the authenticated backend. The configured OpenAI model generates a suggested filename, alt text, caption, up to five tags, and three original doodle concepts. Users can review and apply the suggestions; a selected doodle can be used as artwork for the asset.

The AI request uses the asset name, type, file extension, and text context supplied by the form. It does not upload or inspect the actual asset file. The backend sanitizes returned SVG drawings to allow only supported vector shapes and attributes before sending them to the frontend.

The endpoint is `POST /api/ai/metadata/` and requires authentication. Its JSON request can include `asset_name`, `asset_type`, `file_extension`, and `content_context`. The response returns the generated fields under `suggestions`.

Configure `OPENAI_API_KEY` in `backend/.env` to enable this feature. `AI_MODEL` is optional and defaults to `gpt-4o-mini`; set it to another model supported by your OpenAI project if needed. AI suggestions are unavailable when the key is missing or the provider request fails.
