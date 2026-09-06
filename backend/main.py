from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Dev-Arena backend is alive"}

# --- New: Run code via Piston ---
@app.post("/run")
def run_code(payload: dict):
    code = payload.get("code", "")
    language = payload.get("language", "python")

    response = requests.post(
        "https://emkc.org/api/v2/piston/execute",
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