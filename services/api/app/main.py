from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.modules.auth.router import router as auth_router
from app.modules.comparador.router import router as comparador_router
from app.modules.dividends.router import router as dividends_router
from app.modules.fx.router import router as fx_router
from app.modules.goals.router import router as goals_router
from app.modules.ingestion.router import router as ingestion_router
from app.modules.movements.router import router as movements_router
from app.modules.portfolios.router import router as portfolios_router
from app.modules.screener.router import router as screener_router
from app.modules.tags.router import router as tags_router

app = FastAPI(title="Investment App 3.0 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/v1")
app.include_router(portfolios_router, prefix="/v1")
app.include_router(fx_router, prefix="/v1")
app.include_router(tags_router, prefix="/v1")
app.include_router(goals_router, prefix="/v1")
app.include_router(screener_router, prefix="/v1")
app.include_router(comparador_router, prefix="/v1")
app.include_router(dividends_router, prefix="/v1")
app.include_router(movements_router, prefix="/v1")
app.include_router(ingestion_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
