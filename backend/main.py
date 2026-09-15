from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
from database import engine, Base
import random
import string
from fastapi import Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Room, Student, Submission, TeacherEdit, Question

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_room_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/create-room")
def create_room(payload: dict, db: Session = Depends(get_db)):
    instructor_name = payload.get("instructor_name", "Unknown")
    mode = payload.get("mode", "teaching")
    questions = payload.get("questions", [])

    room_code = generate_room_code()
    new_room = Room(room_code=room_code, instructor_name=instructor_name, mode=mode)
    db.add(new_room)
    db.commit()
    db.refresh(new_room)

    if mode == "assessment":
        for index, q in enumerate(questions):
            new_question = Question(
                room_id=new_room.id,
                question_text=q.get("question_text", ""),
                expected_output=q.get("expected_output", ""),
                order_index=index
            )
            db.add(new_question)
        db.commit()

    return {"room_code": new_room.room_code, "instructor_name": new_room.instructor_name, "mode": new_room.mode}

@app.get("/")
def read_root():
    return {"message": "Dev-Arena backend is alive"}

@app.get("/join-room/{room_code}")
def join_room(room_code: str, student_name: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_code == room_code).first()
    if not room:
        return {"error": "Room not found"}
    if room.ended:
        return {"error": "This session has ended and is no longer accepting students."}

    new_student = Student(name=student_name, room_code=room_code)
    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    questions_list = []
    if room.mode == "assessment":
        questions = db.query(Question).filter(Question.room_id == room.id).order_by(Question.order_index).all()
        questions_list = [
            {"id": q.id, "question_text": q.question_text, "order_index": q.order_index}
            for q in questions
        ]

    return {
        "room_code": room.room_code,
        "instructor_name": room.instructor_name,
        "student_id": new_student.id,
        "mode": room.mode,
        "questions": questions_list
    }

@app.get("/room-mode/{room_code}")
def room_mode(room_code: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_code == room_code).first()
    if not room:
        return {"error": "Room not found"}
    question_count = 0
    if room.mode == "assessment":
        question_count = db.query(Question).filter(Question.room_id == room.id).count()
    return {"mode": room.mode, "question_count": question_count, "ended": room.ended}

@app.post("/end-session/{room_code}")
def end_session(room_code: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_code == room_code).first()
    if not room:
        return {"error": "Room not found"}
    room.ended = True
    db.commit()
    return {"message": "Session ended"}

@app.get("/room-status/{room_code}")
def room_status(room_code: str, db: Session = Depends(get_db)):
    all_submissions = db.query(Submission).filter(Submission.room_code == room_code).order_by(Submission.submitted_at).all()

    latest_per_student = {}
    question_results_per_student = {}

    for sub in all_submissions:
        latest_per_student[sub.student_name] = {
            "code": sub.code,
            "output": sub.output,
            "status": sub.status,
            "is_correct": sub.is_correct,
            "question_id": sub.question_id
        }

        if sub.question_id is not None:
            if sub.student_name not in question_results_per_student:
                question_results_per_student[sub.student_name] = {}
            question_results_per_student[sub.student_name][sub.question_id] = sub.is_correct

    for name in latest_per_student:
        latest_per_student[name]["question_results"] = question_results_per_student.get(name, {})

    currently_connected = connected_students.get(room_code, set())

    result = {}
    for name in currently_connected:
        if name in latest_per_student:
            result[name] = latest_per_student[name]
        else:
            result[name] = {"code": "", "output": "", "status": "none"}

    return result

# --- New: Run code via Piston ---

@app.post("/run")
def run_code(payload: dict, db: Session = Depends(get_db)):
    code = payload.get("code", "")
    language = payload.get("language", "python")
    student_name = payload.get("student_name", "Unknown")
    room_code = payload.get("room_code", "Unknown")
    question_id = payload.get("question_id")
    stdin_input = payload.get("stdin", "")

    response = requests.post(
    "http://127.0.0.1:2000/api/v2/execute",
        json={
            "language": language,
            "version": "*",
            "files": [{"content": code}],
            "stdin": stdin_input
        }
    )
    result = response.json()
    print("PISTON RESPONSE:", result)

    stdout = result.get("run", {}).get("output", "")
    stderr = result.get("run", {}).get("stderr", "")
    output_text = stdout or stderr
    status = "error" if stderr else "ok"

    is_correct = None
    if question_id:
        question = db.query(Question).filter(Question.id == question_id).first()
        if question:
            is_correct = stdout.strip() == question.expected_output.strip()

    new_submission = Submission(
        student_name=student_name,
        room_code=room_code,
        code=code,
        output=output_text,
        status=status,
        question_id=question_id,
        is_correct=is_correct
    )
    db.add(new_submission)
    db.commit()

    return {
        "output": result.get("run", {}).get("output", ""),
        "stderr": result.get("run", {}).get("stderr", ""),
        "is_correct": is_correct
    }

# --- WebSocket setup (already working) ---
connected_clients = {}  # { room_code: [list of websockets] }
connected_students = {}  # { room_code: set of student names currently connected }

@app.websocket("/ws/{room_code}")
async def websocket_endpoint(websocket: WebSocket, room_code: str):
    await websocket.accept()

    if room_code not in connected_clients:
        connected_clients[room_code] = []
    connected_clients[room_code].append(websocket)

    if room_code not in connected_students:
        connected_students[room_code] = set()

    connected_student_name = None

    try:
        while True:
            data = await websocket.receive_text()

            try:
                parsed = json.loads(data)
                if parsed.get("type") == "join":
                    connected_student_name = parsed.get("student_name")
                    connected_students[room_code].add(connected_student_name)
            except Exception:
                pass

            for client in connected_clients[room_code]:
                await client.send_text(data)
    except Exception:
        connected_clients[room_code].remove(websocket)

        if connected_student_name:
            connected_students[room_code].discard(connected_student_name)

            leave_message = json.dumps({
                "type": "leave",
                "student_name": connected_student_name
            })
            for client in connected_clients[room_code]:
                await client.send_text(leave_message)

@app.post("/teacher-edit")
def save_teacher_edit(payload: dict, db: Session = Depends(get_db)):
    student_name = payload.get("student_name", "Unknown")
    room_code = payload.get("room_code", "Unknown")
    original_code = payload.get("original_code", "")
    edited_code = payload.get("edited_code", "")

    new_edit = TeacherEdit(
        student_name=student_name,
        room_code=room_code,
        original_code=original_code,
        edited_code=edited_code
    )
    db.add(new_edit)
    db.commit()

    return {"message": "Edit saved successfully"}