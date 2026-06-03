# Single-monolith image (CLAUDE.md §9): build the React bundle, then run FastAPI
# which serves that bundle AND the in-process scheduled refresh. One deploy target,
# no CORS. Works on Railway / Render / Fly.

# --- Stage 1: build the frontend ---
FROM node:20-alpine AS frontend
WORKDIR /app/frontend-app
COPY frontend-app/package*.json ./
RUN npm ci
COPY frontend-app/ ./
RUN npm run build

# --- Stage 2: python runtime ---
FROM python:3.12-slim
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# The built frontend must sit at ../frontend-app/dist relative to the backend.
COPY --from=frontend /app/frontend-app/dist /app/frontend-app/dist

ENV SOURCE=snapshot
EXPOSE 8000
# Hosts inject $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
