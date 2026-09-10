from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import requests
from database import engine, Base
import random
import string
from fastapi import Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Room, Student, Submission

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
def create_room(instructor_name: str, db: Session = Depends(get_db)):
    room_code = generate_room_code()
    new_room = Room(room_code=room_code, instructor_name=instructor_name)
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return {"room_code": new_room.room_code, "instructor_name": new_room.instructor_name}

@app.get("/")
def read_root():
    return {"message": "Dev-Arena backend is alive"}

@app.get("/join-room/{room_code}")
def join_room(room_code: str, student_name: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_code == room_code).first()
    if not room:
        return {"error": "Room not found"}

    new_student = Student(name=student_name, room_code=room_code)
    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return {"room_code": room.room_code, "instructor_name": room.instructor_name, "student_id": new_student.id}

# --- New: Run code via Piston ---

@app.post("/run")
def run_code(payload: dict, db: Session = Depends(get_db)):
    code = payload.get("code", "")
    language = payload.get("language", "python")
    student_name = payload.get("student_name", "Unknown")
    room_code = payload.get("room_code", "Unknown")

    response = requests.post(
    "http://127.0.0.1:2000/api/v2/execute",
        json={
            "language": language,
            "version": "*",
            "files": [{"content": code}]
        }
    )
    result = response.json()
    print("PISTON RESPONSE:", result)

    output_text = result.get("run", {}).get("output", "") or result.get("run", {}).get("stderr", "")

    new_submission = Submission(
        student_name=student_name,
        room_code=room_code,
        code=code,
        output=output_text
    )
    db.add(new_submission)
    db.commit()

    return {
        "output": result.get("run", {}).get("output", ""),
        "stderr": result.get("run", {}).get("stderr", "")
    }

# --- WebSocket setup (already working) ---
connected_clients = {}  # { room_code: [list of websockets] }

@app.websocket("/ws/{room_code}")
async def websocket_endpoint(websocket: WebSocket, room_code: str):
    await websocket.accept()

    if room_code not in connected_clients:
        connected_clients[room_code] = []
    connected_clients[room_code].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            for client in connected_clients[room_code]:
                await client.send_text(data)
    except Exception:
        connected_clients[room_code].remove(websocket)