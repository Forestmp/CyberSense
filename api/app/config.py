"""Configuración leída del entorno (archivo .env en desarrollo)."""
import sys
from typing import Literal

from pydantic import Field, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    ENV: Literal['development', 'test', 'production'] = 'development'
    CORS_ORIGINS: str = ''
    DATABASE_URL: str = Field(min_length=1)
    DB_SSL: bool = True
    DB_POOL_MAX: int = Field(default=10, gt=0)
    JWT_SECRET: str = Field(min_length=32)
    JWT_EXPIRES_HOURS: int = Field(default=8, gt=0)
    BCRYPT_ROUNDS: int = Field(default=12, ge=4, le=15)
    # Número de proxies delante de la API (Render = 1). Necesario para que el
    # límite de intentos use la IP real del cliente.
    TRUST_PROXY: int = Field(default=0, ge=0)
    # Correo (recuperación de contraseña)
    MAIL_PROVIDER: Literal['console', 'brevo'] = 'console'
    BREVO_API_KEY: str | None = None
    MAIL_FROM_EMAIL: str | None = None
    MAIL_FROM_NAME: str = 'CyberSense'
    # Administrador inicial (solo lo usa scripts/seed.py)
    ADMIN_NAME: str = 'Administrador'
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None

    @model_validator(mode='after')
    def _correo(self):
        if self.MAIL_PROVIDER == 'brevo':
            faltan = [k for k in ('BREVO_API_KEY', 'MAIL_FROM_EMAIL') if not getattr(self, k)]
            if faltan:
                raise ValueError(f'Obligatorias con MAIL_PROVIDER=brevo: {", ".join(faltan)}')
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(',') if o.strip()]


try:
    settings = Settings()
except ValidationError as err:
    detalle = '\n'.join(f"  - {'.'.join(map(str, e['loc'])) or 'config'}: {e['msg']}" for e in err.errors())
    sys.exit(f'Configuración inválida. Revisa tu archivo .env:\n{detalle}')
