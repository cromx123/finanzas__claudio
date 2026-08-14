from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    internal_api_secret: str = "dev-internal-secret-change-me"

    ingest_tz: str = "America/Santiago"
    ingest_cron_santiago: str = "05 17 * * 1-5"
    ingest_cron_nyse: str = "05 16 * * 1-5"
    fx_source: str = "yahoo"


settings = Settings()
