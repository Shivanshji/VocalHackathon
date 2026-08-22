import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ai.speech.factcheck_gate import GeminiGate
from ai.speech.stt import WhisperTranscriber
from ai.speech.translator import IndicTransTranslator
from backend.config import get_settings
from backend.routes.analyze_audio import router as analyze_router
from backend.routes.health import router as health_router
from backend.services.pipeline import AudioPipeline
from backend.services.fact_checker import FactCheckerClient

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = FastAPI(title="Person 2 Speech Pipeline", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.state.settings = settings
app.state.pipeline = AudioPipeline(WhisperTranscriber(settings), IndicTransTranslator(settings), GeminiGate(settings),
                                   FactCheckerClient(settings.fact_checker_url))
app.include_router(health_router)
app.include_router(analyze_router)
