from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import requests
from database import engine, Base
from models import Room
import random
import string
from fastapi import Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Room

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
def join_room(room_code: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_code == room_code).first()
    if not room:
        return {"error": "Room not found"}
    return {"room_code": room.room_code, "instructor_name": room.instructor_name}

# --- New: Run code via Piston ---
@app.post("/run")
def run_code(payload: dict):
    code = payload.get("code", "")
    language = payload.get("language", "python")

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
    return {
        "output": result.get("run", {}).get("output", ""),
        "stderr": result.get("run", {}).get("stderr", "")
    }

# --- WebSocket setup (already working) ---
connected_clients = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            for client in connected_clients:
                await client.send_text(data)
    except Exception:
        connected_clients.remove(websocket)