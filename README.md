# CareConnect Health + Meal Planner

CareConnect is a unified healthcare and nutrition application:

- The React/Vite web application serves the CareConnect dashboard and integrated Meal Planner.
- One FastAPI service owns healthcare, authentication, nutrition, saved meal plans, reviews, cycle tracking, chat, and ingredient detection.
- One MySQL `careconnect_pro` schema stores application data.

Only two application servers are required: the web server and FastAPI. MySQL remains the database process.

## Architecture

```text
Browser: React/Vite UI on port 3000
        |
        `-- /api/* --> CareConnect FastAPI on port 8000
                       - authentication and users
                       - records, prescriptions, appointments
                       - messaging, notifications, and RAG
                       - /api/meal-planner/* nutrition routes
                       - shared patient authentication and context

MySQL: careconnect_pro
```

## Functionality

CareConnect includes patient, clinician, and administrator accounts; Google sign-in; clinician approval; medical-record extraction and version history; prescriptions; appointments; messaging; notifications; administration; AI summaries; RAG; and health chat.

The integrated Meal Planner includes:

- mood, diet, cuisine, allergy, and available-ingredient preferences;
- Gemini meal generation with a deterministic allergy-aware fallback;
- Gemini image ingredient recognition when configured;
- saved meal plans and owner-only deletion;
- reviews, ratings, optional images, and owner-only deletion;
- nutrition profile and goals;
- menstrual-cycle settings, journal, dashboard, and pattern summaries;
- meal chat, voice mood detection, and CareConnect-aware authentication.

Clinicians can publish weekly consultation hours and choose 15, 30, 45, or
60-minute appointment slots. Patients see those hours and can select only open
future slots. Voice and typed prescriptions share one structured, reviewable
prescription workflow.

Each new prescription is linked into the clinician-patient conversation as a
structured message card. Connected clinicians can open a comprehensive patient
profile containing medical summaries, records, prescriptions, appointments,
current body-composition data, and longitudinal measurements. Administrators
can update demographics, status, vitals, and body composition; every update
archives the previous state in immutable profile history.

## Unified login flow

1. A patient signs in to CareConnect and receives the normal patient JWT.
2. Opening the Meal Planner calls `POST /api/meal-planner/careconnect/session` on the same FastAPI server.
3. FastAPI creates or loads the patient-owned nutrition profile in `careconnect_pro`.
4. All Meal Planner requests reuse the CareConnect JWT; there is no second user account, token, database, or internal HTTP call.

## Run with Docker

Copy the environment template:

```powershell
Copy-Item .env.example .env
```

Set at least:

```env
MYSQL_ROOT_PASSWORD=a-strong-database-password
CARECONNECT_SECRET_KEY=a-long-random-careconnect-secret
```

Optionally set `GEMINI_API_KEY` for live meal generation, meal chat, health tips, and ingredient recognition. Safe fallbacks remain available without it.

Start the stack:

```powershell
docker compose up --build
```

Open:

- Web application: `http://localhost:3000`
- FastAPI documentation: `http://localhost:8000/docs`
- Health endpoint: `http://localhost:8000/api/health`

Stop it with:

```powershell
docker compose down
```

## Run locally

Use Python 3.11, matching the backend Docker image. Python 3.14 is not currently supported by every Google/Protobuf dependency.

Create the database:

```sql
CREATE DATABASE careconnect_pro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Start FastAPI:

```powershell
cd services/careconnect
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal, start the web application:

```powershell
cd apps/web
npm install
npm run dev
```

Vite serves `http://localhost:3000` and proxies all `/api` requests to FastAPI.

## First Meal Planner use

The first time a patient opens Meal Planner, FastAPI creates a nutrition profile with conservative defaults. Use the profile dialog to set the correct weight, unit, goal, and optional cycle preferences.

## Project layout

```text
careconnect-suite/
|-- apps/web/                         # Combined React UI
|   `-- src/meal-planner/             # Meal Planner screens
|-- services/careconnect/             # Unified FastAPI backend
|   |-- main.py
|   `-- meal_planner.py               # Integrated nutrition routes
|-- db/init.sql
|-- docker-compose.yml
|-- .env.example
`-- README.md
```

The legacy `services/meal-planner` Express source is retained temporarily for migration reference, but it is no longer built, started, proxied, or required.
