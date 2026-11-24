"""
Carga datos iniciales. Idempotente: no duplica registros existentes.
 1. Archivos .sql de db/seeds (catálogos, rangos provisionales).
 2. Usuario administrador, si ADMIN_EMAIL y ADMIN_PASSWORD están definidos.
 3. Escenarios de db/seeds/escenarios/*.json (se omiten si su código ya existe).

Con --actualizar-escenarios, los escenarios existentes se sobrescriben con su
JSON (conservando ids de lo que mantiene su clave). Sobrescribe cambios
hechos desde la app, así que úsalo solo en desarrollo.
"""
import json
import sys
from pathlib import Path

from psycopg.types.json import Jsonb
from pydantic import ValidationError

from app.config import settings
from app.db import pool, query_one, transaction
from app.errors import detalles_validacion
from app.modules import scenarios_repo as repo
from app.modules import scenarios_service
from app.modules.scenarios_schemas import EscenarioDoc
from app.modules.scenarios_structure import validar_estructura
from app.security import hash_password

DIR = Path(__file__).resolve().parent.parent / 'db' / 'seeds'


def _seed_sql():
    with pool.connection() as conn:
        for archivo in sorted(DIR.glob('*.sql')):
            conn.execute(archivo.read_text(encoding='utf-8'))
            print(f'✔ {archivo.name}')


def _seed_admin() -> int | None:
    correo, password = settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD
    if not correo or not password:
        print('· Administrador omitido (define ADMIN_EMAIL y ADMIN_PASSWORD en .env)')
        return None
    existente = query_one('SELECT id FROM usuarios WHERE lower(correo) = lower(%s)', (correo,))
    if existente:
        print(f'· Administrador {correo} ya existe')
        return existente['id']
    fila = query_one(
        """INSERT INTO usuarios (nombre, correo, password_hash, rol, fecha_aceptacion_aviso)
           VALUES (%s, lower(%s), %s, 'administrador', now()) RETURNING id""",
        (settings.ADMIN_NAME, correo, hash_password(password)),
    )
    print(f'✔ Administrador {correo} creado')
    return fila['id']


def _seed_escenarios(admin_id: int | None, actualizar: bool):
    for archivo in sorted((DIR / 'escenarios').glob('*.json')):
        crudo = json.loads(archivo.read_text(encoding='utf-8'))
        try:
            doc = EscenarioDoc.model_validate(crudo).model_dump()
        except ValidationError as err:
            detalle = '\n  - '.join(f"{d['campo']}: {d['mensaje']}" for d in detalles_validacion(err.errors()))
            raise RuntimeError(f'{archivo.name} inválido:\n  - {detalle}') from err
        doc['codigo'] = crudo['codigo']
        errores = validar_estructura(doc)
        if errores:
            raise RuntimeError(f'{archivo.name} inválido:\n  - ' + '\n  - '.join(errores))

        existe = query_one('SELECT id FROM escenarios WHERE codigo = %s', (doc['codigo'],))
        if existe and actualizar:
            scenarios_service.actualizar(existe['id'], doc)
            print(f"✔ Escenario {doc['codigo']} actualizado desde {archivo.name}")
            continue
        if existe:
            print(f"· Escenario {doc['codigo']} ya existe")
            continue
        with transaction() as conn:
            cat = repo.resolver_catalogos(conn, doc['subcategoria'], doc['dificultad'])
            if not cat['subcategoria_id'] or not cat['dificultad_id']:
                raise RuntimeError(f'{archivo.name}: subcategoría o dificultad desconocidas')
            repo.crear(conn, doc, cat, admin_id)
        print(f"✔ Escenario {doc['codigo']} · {doc['titulo']}")


def _seed_diagnostico(actualizar: bool):
    """
    Preguntas del examen diagnóstico desde db/seeds/diagnostico.json, una activa
    por subcategoría (RN-25). Las señales de alerta se guardan en el contenido
    para mostrarlas en el resultado.
    """
    datos = json.loads((DIR / 'diagnostico.json').read_text(encoding='utf-8'))
    creadas = actualizadas = 0
    with transaction() as conn:
        for q in datos['preguntas']:
            sub = conn.execute('SELECT id FROM subcategorias WHERE clave = %s', (q['subcategoria'],)).fetchone()
            if not sub:
                raise RuntimeError(f"diagnostico.json: subcategoría desconocida {q['subcategoria']}")
            contenido = Jsonb({**q['contenido'], 'senales': q['senales']})
            existente = conn.execute(
                'SELECT id FROM preguntas_diagnostico WHERE subcategoria_id = %s AND activa', (sub['id'],)
            ).fetchone()
            if existente and not actualizar:
                continue
            if existente:
                pregunta_id = existente['id']
                conn.execute('UPDATE preguntas_diagnostico SET orden = -orden WHERE id = %s', (pregunta_id,))
                conn.execute('UPDATE preguntas_diagnostico SET orden = %s, enunciado = %s, contenido = %s WHERE id = %s',
                             (q['orden'], q['enunciado'], contenido, pregunta_id))
                for i, o in enumerate(q['opciones'], start=1):
                    conn.execute(
                        """INSERT INTO opciones_diagnostico (pregunta_id, orden, texto, puntuacion) VALUES (%s, %s, %s, %s)
                           ON CONFLICT (pregunta_id, orden) DO UPDATE SET texto = EXCLUDED.texto,
                             puntuacion = EXCLUDED.puntuacion""",
                        (pregunta_id, i, o['texto'], o['puntuacion']))
                actualizadas += 1
                continue
            pregunta_id = conn.execute(
                """INSERT INTO preguntas_diagnostico (subcategoria_id, orden, enunciado, contenido)
                   VALUES (%s, %s, %s, %s) RETURNING id""",
                (sub['id'], q['orden'], q['enunciado'], contenido),
            ).fetchone()['id']
            for i, o in enumerate(q['opciones'], start=1):
                conn.execute('INSERT INTO opciones_diagnostico (pregunta_id, orden, texto, puntuacion) VALUES (%s, %s, %s, %s)',
                             (pregunta_id, i, o['texto'], o['puntuacion']))
            creadas += 1
    print(f'✔ Examen diagnóstico: {creadas} pregunta(s) creada(s), {actualizadas} actualizada(s)')


def seed(actualizar: bool = False):
    _seed_sql()
    admin_id = _seed_admin()
    _seed_escenarios(admin_id, actualizar)
    _seed_diagnostico(actualizar)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')  # la consola de Windows usa cp1252 por omisión
    pool.open()
    try:
        seed(actualizar='--actualizar-escenarios' in sys.argv)
    except RuntimeError as err:
        sys.exit(str(err))
    finally:
        pool.close()
