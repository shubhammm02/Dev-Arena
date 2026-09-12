# Dev-Arena

A real-time classroom coding platform. Instructors create live sessions via a room code; students join on their own PCs, write and run code in a browser-based editor, and results stream live to the instructor's dashboard.

Dev-Arena is being built around two complementary modes:
- **Teaching Mode** (built): live monitoring and in-the-moment help during coding labs — the instructor sees what every student is writing, who's stuck, and can step in directly.
- **Assessment Mode** (in progress): auto-evaluated coding exercises, where a student's output is checked against an expected answer and marked correct/incorrect on the instructor's dashboard.

## Problem Statement

Traditional classroom coding assessments rely on instructors manually walking around to check each student's screen, or collecting code after the fact with no visibility into the process. This makes it hard to spot struggling students in real time, verify authentic participation, or run quick in-class coding exercises efficiently. Dev-Arena solves this by giving instructors a live, centralized view of every student's code and output as they write and run it — whether the goal is teaching support or graded assessment.

## Core Concept

1. An instructor creates a session and receives a unique room code.
2. Students join the session using that room code and their name.
3. Each student writes and runs code in a Monaco-powered editor (the same editor used in VS Code).
4. Every time a student runs (or even just edits) their code, the result streams live to the instructor's dashboard over WebSockets — no refresh needed.
5. The instructor can see who's connected, who's stuck, who's asked for help, and — soon — whose answer is correct.
6. All rooms, students, and submissions are persisted to a database for later review.

## Tech Stack

**Frontend**
- React + Vite
- Monaco Editor (`@monaco-editor/react`), including the Diff Editor for instructor code review
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

## Architecture

```
Student Browser                Instructor Browser
      |                              ^
      | (join, type, run code)       | (live dashboard updates)
      v                              |
              FastAPI Backend
              /        |        \
        Room Mgmt   WebSocket   Code Exec
        (Postgres)  (per-room)  (Piston/Docker)
                        |
                   PostgreSQL
       (rooms, students, submissions, teacher_edits)
```

- **Room-scoped WebSockets**: each room code maps to its own set of connected clients, so live updates only broadcast within that room — not across the whole app.
- **Live presence tracking**: the backend tracks who's actually connected right now (separate from submission history), so the dashboard always reflects reality — including instantly removing a student the moment they disconnect.
- **Persistent submission history**: every code run is saved to the `submissions` table (student name, room code, code, output, status, timestamp), so nothing is lost even if the dashboard is refreshed.
- **Refresh-safe instructor sessions**: an instructor's role and room are kept in `sessionStorage`, and the dashboard restores itself from the database on reload instead of resetting.

## Current Status

### Teaching Mode — done
- ✅ Room creation (instructor) and join flow (student), backed by PostgreSQL
- ✅ Monaco code editor with language selection (Python, C, C++, Java)
- ✅ Code execution via self-hosted Piston, running in Docker
- ✅ Room-scoped WebSocket live sync
- ✅ Live instructor dashboard: scannable student list, click-to-expand detail view
- ✅ Status indicators per student — success (green), error (red), not run yet (gray) — with live counts
- ✅ Live code streaming: instructor can see a student's current code even before they hit Run
- ✅ "Raise Hand" — students can flag that they need help; instructor sees it instantly
- ✅ Teacher code editing via Monaco Diff Editor, saved separately without overwriting the student's original submission
- ✅ Live teacher-to-student fix delivery — instructor's edit is sent to the student as a dismissible suggestion, not a silent overwrite
- ✅ Accurate live presence tracking (join/leave), refresh-safe instructor dashboard

### Assessment Mode — in progress
- 🔲 Mode selection when creating a room (Teaching vs. Assessment)
- 🔲 Instructor sets an expected output for an exercise
- 🔲 Automatic correct/incorrect evaluation of student submissions
- 🔲 Correct/Incorrect badge on the instructor's dashboard

## License

MIT
