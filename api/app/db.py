"""Pool de conexiones a PostgreSQL (psycopg 3)."""
from contextlib import contextmanager

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.numeric import FloatLoader
from psycopg_pool import ConnectionPool

from app.config import settings


def _configurar(conn: Connection):
    # NUMERIC llega como Decimal por defecto; los valores del sistema caben de
    # sobra en un float y así se serializan como número en JSON.
    conn.adapters.register_loader('numeric', FloatLoader)


pool = ConnectionPool(
    settings.DATABASE_URL,
    min_size=1,
    max_size=settings.DB_POOL_MAX,
    kwargs={'row_factory': dict_row, 'autocommit': True, 'sslmode': 'require' if settings.DB_SSL else 'disable'},
    configure=_configurar,
    open=False,
)


def query(sql: str, params=None) -> list[dict]:
    """Ejecuta una consulta fuera de transacción y devuelve las filas."""
    with pool.connection() as conn:
        cur = conn.execute(sql, params)
        return cur.fetchall() if cur.description else []


def query_one(sql: str, params=None) -> dict | None:
    filas = query(sql, params)
    return filas[0] if filas else None


@contextmanager
def transaction():
    """Entrega una conexión dentro de una transacción; hace ROLLBACK si falla."""
    with pool.connection() as conn:
        with conn.transaction():
            yield conn
