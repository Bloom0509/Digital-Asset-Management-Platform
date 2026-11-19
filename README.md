# Digital Asset Management

A multi-tenant digital asset management application with a React frontend and a Django REST API. Users can manage workspaces, upload and organize assets, search asset metadata, review activity, and request AI-generated metadata suggestions.

## Project structure

- `frontend/` — React 19, JavaScript, and Vite
- `backend/` — Django 5 and Django REST Framework
- `infra/docker-compose.yml` — PostgreSQL, Redis, and MinIO development services
- `docs/` — architecture and implementation notes

## Requirements

- Python 3.10 or newer
- Node.js and npm
- PostgreSQL 17, either installed locally or run with Docker Compose
- Docker Desktop, if using the Compose services

## Quick start (Windows PowerShell)

### 1. Configure the backend

From the repository root, create the backend environment file and set a local PostgreSQL password:

```powershell
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env`. Set `POSTGRES_PASSWORD` to a password for the local database. The other PostgreSQL defaults are `DigitalAssetManagement`, `postgres`, `localhost`, and `5432`. Keep this file private; it contains local credentials.

### 2. Start PostgreSQL

To use the Compose PostgreSQL service, run this from the repository root:

```powershell
docker compose --env-file backend/.env -f infra/docker-compose.yml up -d postgres
```

Alternatively, start a local PostgreSQL 17 server and create the database and role configured in `backend/.env`. Use one PostgreSQL server on port `5432` at a time.

Redis and MinIO are also defined in Compose for development, but the current Django configuration stores uploaded files in local media storage and does not require those services to run:

```powershell
docker compose --env-file backend/.env -f infra/docker-compose.yml up -d redis minio
```

### 3. Install and start the backend

In a PowerShell terminal from the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000/`. The root URL is a health check. Uploaded files are saved under `backend/media/` by default; set `DAM_MEDIA_ROOT` in `backend/.env` to use another local directory. The default upload limit is 50 MiB (`DAM_MAX_UPLOAD_SIZE` is measured in bytes).

### 4. Install and start the frontend

Open a second terminal from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the frontend URL, usually `http://localhost:5173/`. The backend's default CORS configuration allows this origin.

### 5. Create an account and sign in

Register an account through `POST /api/accounts/register/` with `username`, `email`, and `password` (first and last name are optional). Then obtain a JWT at `POST /api/auth/token/` using the username and password. The authenticated `GET /api/tenants/` endpoint creates a default workspace if the account has no workspace yet.

## AI metadata suggestions

The authenticated endpoint `POST /api/ai/metadata/` generates a suggested filename, alt text, caption, up to five tags, and three SVG drawing concepts. The request may include `asset_name`, `asset_type`, `file_extension`, and `content_context`. The service uses the text supplied by the form; it does not upload or inspect an asset file. Returned SVG drawings are sanitized before they are sent to the frontend.

Set `OPENAI_API_KEY` in `backend/.env` to enable suggestions. `AI_MODEL` is optional and defaults to `gpt-4o-mini`. Suggestions return an error if the key is missing or the provider request fails.

## Current implementation notes

- Search supports keyword matching across asset metadata, filtering, sorting, and pagination. Semantic search, RAG, and AI agents are not currently exposed as working application features.
- The Compose file uses a pgvector-enabled PostgreSQL image, but that does not by itself mean every vector-related feature is configured or active.
- Uploaded assets use Django's local media storage by default. Redis and MinIO are available as optional local services, but the current backend does not require them.
- `frontend/README.md` contains frontend-specific setup notes.

## Useful commands

Apply backend migrations after updating the code:

```powershell
cd backend
python manage.py migrate
```

Frontend production build and lint:

```powershell
cd frontend
npm run build
npm run lint
```
