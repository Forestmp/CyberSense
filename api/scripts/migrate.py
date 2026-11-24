"""
Aplica en orden los archivos de db/migrations que aún no se han ejecutado.
  python -m scripts.migrate            aplica las pendientes
  python -m scripts.migrate --reset    BORRA las tablas de public y las recrea (solo desarrollo)
"""
import sys
from pathlib import Path

from app.config import settings
from app.db import pool

DIR = Path(__file__).resolve().parent.parent / 'db' / 'migrations'


def _reset(conn):
    if settings.ENV == 'production':
        raise RuntimeError('--reset no está permitido en producción')
    # Se eliminan solo nuestros objetos para no tocar extensiones ni objetos de Supabase.
    for fila in conn.execute("SELECT viewname FROM pg_views WHERE schemaname = 'public'").fetchall():
        conn.execute(f'DROP VIEW IF EXISTS public."{fila["viewname"]}" CASCADE')
    for fila in conn.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'").fetchall():
        conn.execute(f'DROP TABLE IF EXISTS public."{fila["tablename"]}" CASCADE')
    conn.execute('DROP FUNCTION IF EXISTS fn_set_fecha_actualizacion() CASCADE')
    print('Esquema reiniciado.')


def migrate(reset_first: bool = False):
    with pool.connection() as conn:
        if reset_first:
            _reset(conn)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
              nombre      VARCHAR(255) PRIMARY KEY,
              aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
            )""")
        conn.execute('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY')

        aplicadas = {f['nombre'] for f in conn.execute('SELECT nombre FROM schema_migrations').fetchall()}
        n = 0
        for archivo in sorted(DIR.glob('*.sql')):
            if archivo.name in aplicadas:
                continue
            try:
                with conn.transaction():
                    conn.execute(archivo.read_text(encoding='utf-8'))
                    conn.execute('INSERT INTO schema_migrations (nombre) VALUES (%s)', (archivo.name,))
            except Exception as err:
                raise RuntimeError(f'Falló la migración {archivo.name}: {err}') from err
            print(f'✔ {archivo.name}')
            n += 1
        print(f'{n} migración(es) aplicada(s).' if n else 'Sin migraciones pendientes.')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')  # la consola de Windows usa cp1252 por omisión
    pool.open()
    try:
        migrate(reset_first='--reset' in sys.argv)
    except RuntimeError as err:
        sys.exit(str(err))
    finally:
        pool.close()
