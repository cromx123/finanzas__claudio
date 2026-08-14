from fastapi import FastAPI

from app.modules.auth.router import router as auth_router
from app.modules.ingestion.router import router as ingestion_router

app = FastAPI(title="Investment App 3.0 API", version="0.1.0")

app.include_router(auth_router, prefix="/v1")
app.include_router(ingestion_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
