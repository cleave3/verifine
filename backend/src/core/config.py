from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )
    
    PROJECT_NAME: str = "Verifine API"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "very-secret-do-not-use-in-prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/verifine"

Config = Settings()
