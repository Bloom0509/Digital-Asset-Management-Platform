# Frontend

The frontend is a React 19 application written in JavaScript and bundled with Vite. It uses React Router for navigation and calls the Django API in `../backend`.

## Run locally

From this directory, install dependencies and start the Vite development server:

```powershell
npm install
npm run dev
```

The development server normally runs at `http://localhost:5173/`. Start the backend separately and configure its `CORS_ALLOWED_ORIGINS` to include the frontend origin.

## Available scripts

- `npm run dev` — start the local Vite server
- `npm run build` — create a production bundle in `dist/`
- `npm run preview` — serve the production bundle locally
- `npm run lint` — run ESLint
