from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health(): assert client.get("/health").json() == {"status": "ok"}
def test_unsupported(): assert client.post("/api/analyze-audio", files={"audio": ("x.txt", b"x")}).status_code == 415
def test_empty(): assert client.post("/api/analyze-audio", files={"audio": ("x.wav", b"")}).status_code == 400


def test_local_frontend_origins_are_allowed_by_cors():
    for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        response = client.options(
            "/api/analyze-audio-stream",
            headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
