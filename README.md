# Stackfolio2

A small full‑stack photo‑gallery application built with **PocketBase** as the backend API and a **Vite + React + TypeScript** frontend. The project is containerised with Docker and orchestrated via a simple `docker‑compose.yml` stack.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Technologies Used](#technologies-used)
3. [Getting Started (Development)](#getting-started-development)
4. [Docker Stack Overview](#docker-stack-overview)
5. [Production‑Ready Checklist](#production-ready-checklist)
6. [Contributing](#contributing)
7. [License](#license)

---

## Project Structure

```
stackfolio2/
├─ backend/                 # PocketBase backend Docker image
│   ├─ Dockerfile           # Builds PocketBase (v0.23.0) on Alpine
│   └─ pb_migrations/       # Migration scripts – creates `photos` collection
│       └─ 170000000_init_photos.js
├─ frontend/                # Vite + React + TypeScript UI
│   ├─ Dockerfile           # Node image that builds the Vite app
│   ├─ index.html
│   ├─ package.json
│   ├─ tsconfig.json
│   ├─ vite.config.ts
│   └─ src/                 # React source code
│       ├─ App.tsx
│       ├─ main.tsx
│       └─ components/UploadModal.tsx
├─ docker-compose.yml       # Orchestrates backend & frontend containers
└─ README.md                # **You are here**
```

*The `photos/` directory is mounted into the backend container as the storage location for uploaded images.*

---

## Technologies Used

| Layer | Technology | Reason |
|-------|------------|--------|
| **Backend** | **PocketBase** (v0.23.0) – lightweight Go‑based DB + auth + file storage | Provides a ready‑made admin UI, authentication, and a simple REST/Realtime API. |
| **Frontend** | **Vite** + **React** + **TypeScript** | Fast dev server, modern React tooling, type safety. |
| **Containerisation** | **Docker** + **docker‑compose** | Guarantees reproducible environments for dev and production. |
| **Styling** | **Tailwind CSS** | Utility‑first CSS framework for rapid UI development. |

---

## Getting Started (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your‑username/stackfolio2.git
   cd stackfolio2
   ```
2. **Start the stack**
   ```bash
   docker compose up --build
   ```
   * The backend will be reachable at `http://localhost:8090`.
   * The frontend dev server runs on `http://localhost:5173`.
3. Open the frontend in a browser, upload photos, and explore the PocketBase admin UI at `http://localhost:8090/_/` (default admin credentials are created by the migration – see *Production‑Ready* section).

---

## Docker Stack Overview

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
    ports:
      - "8090:8090"
    volumes:
      - pb_data:/pb/pb_data
      - ./photos:/pb/pb_data/storage   # host folder ↔ PocketBase storage
    networks:
      - app-network
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules               # keep container‑side node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true        # required for Vite HMR inside Docker
    networks:
      - app-network
    depends_on:
      - backend

volumes:
  pb_data:

networks:
  app-network:
    driver: bridge
```

* The **backend** container runs PocketBase on port **8090** and stores data in a named volume (`pb_data`). The `./photos` bind‑mount mirrors the storage folder for easy access to uploaded files on the host.
* The **frontend** container runs the Vite dev server on port **5173**. The `CHOKIDAR_USEPOLLING` env var is only needed for development; it can be removed for production builds.

---
