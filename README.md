# Dev-Arena

A real-time classroom coding assessment platform. Instructors create live sessions via a room code; students join on their own PCs, write and run code in a browser-based editor, and results stream live to the instructor's dashboard.

## Problem Statement

Traditional classroom coding assessments rely on instructors manually walking around to check each student's screen, or collecting code after the fact with no visibility into the process. This makes it hard to spot struggling students in real time, verify authentic participation, or run quick in-class coding exercises efficiently. Dev-Arena solves this by giving instructors a live, centralized view of every student's code and output as they write and run it.

## Core Concept

1. An instructor creates a session and receives a unique room code.
2. Students join the session using that room code and their name.
3. Each student writes and runs code in a Monaco-powered editor (the same editor used in VS Code).
4. Every time a student runs their code, the result streams live to the instructor's dashboard over WebSockets — no refresh needed.
5. All rooms, students, and submissions are persisted to a database for later review.

## Tech Stack

**Frontend**
- React + Vite
- Monaco Editor (`@monaco-editor/react`)
- WebSockets (native browser API)

**Backend**
- FastAPI (Python)
- SQLAlchemy ORM
- WebSockets (room-scoped, real-time broadcast)

**Code Execution**
- Self-hosted [Piston](https://github.com/engineer-man/piston) via Docker — supports Python, C, C++, and Java

**Database**
- PostgreSQL (Dockerized)

**Planned Deployment**
- Frontend: Netlify
- Backend: Render
- Containerization: Docker / Docker Compose

## Architecture

```
Student Browser                Instructor Browser
      |                              ^
      | (join room, run code)        | (live dashboard updates)
      v                              |
              FastAPI Backend
              /        |        \
        Room Mgmt   WebSocket   Code Exec
        (Postgres)  (per-room)  (Piston/Docker)
                        |
                   PostgreSQL
             (rooms, students, submissions)
```

- **Room-scoped WebSockets**: each room code maps to its own set of connected clients, so live updates only broadcast within that room — not across the whole app.
- **Persistent submission history**: every code run is saved to the `submissions` table (student name, room code, code, output, timestamp), so nothing is lost even if the dashboard is refreshed.

## Current Status

✅ Room creation (instructor) and join flow (student), backed by PostgreSQL
✅ Monaco code editor with language selection (Python, C, C++, Java)
✅ Code execution via self-hosted Piston, running in Docker
✅ Room-scoped WebSocket live sync
✅ Live instructor dashboard showing real-time student submissions
✅ Submission history persisted to database

🔲 Instructor ability to edit student-submitted code (via Monaco Diff Editor, saved separately without overwriting the original)
🔲 UI/UX design pass (current layout is functional, not final)
🔲 Deployment (Netlify + Render)
