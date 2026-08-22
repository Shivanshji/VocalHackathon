from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health(): assert client.get("/health").json() == {"status": "ok"}
def test_unsupported(): assert client.post("/api/analyze-audio", files={"audio": ("x.txt", b"x")}).status_code == 415
def test_empty(): assert client.post("/api/analyze-audio", files={"audio": ("x.wav", b"")}).status_code == 400
