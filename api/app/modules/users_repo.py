"""Acceso a datos de usuarios."""
from psycopg import Connection

from app.db import query, query_one
from app.schemas import escapar_like, paginado

CAMPOS_PUBLICOS = ('id, nombre, correo, rol, estado, fecha_registro, fecha_aceptacion_aviso, fecha_actualizacion, '
                   'fecha_eliminacion, fecha_anonimizacion')


def find_by_id(id_: int) -> dict | None:
    return query_one(f'SELECT {CAMPOS_PUBLICOS} FROM usuarios WHERE id = %s', (id_,))


def find_by_email_with_hash(correo: str) -> dict | None:
    return query_one(
        f'SELECT {CAMPOS_PUBLICOS}, password_hash, token_version FROM usuarios WHERE lower(correo) = lower(%s)',
        (correo,),
    )


def get_token_version(id_: int) -> int:
    fila = query_one('SELECT token_version FROM usuarios WHERE id = %s', (id_,))
    return fila['token_version'] if fila else 0


def get_password_hash(id_: int) -> str | None:
    fila = query_one('SELECT password_hash FROM usuarios WHERE id = %s', (id_,))
    return fila['password_hash'] if fila else None


def listar(pagina: int, limite: int, buscar: str | None, rol: str | None, estado: str | None) -> dict:
    """Listado paginado. Sin filtro de estado se excluyen los eliminados."""
    condiciones, params = [], []
    if buscar:
        patron = f'%{escapar_like(buscar)}%'
        condiciones.append('(u.nombre ILIKE %s OR u.correo ILIKE %s)')
        params += [patron, patron]
    if rol:
        condiciones.append('u.rol = %s')
        params.append(rol)
    if estado:
        condiciones.append('u.estado = %s')
        params.append(estado)
    else:
        condiciones.append("u.estado <> 'eliminada'")
    where = f'WHERE {" AND ".join(condiciones)}'

    total = query_one(f'SELECT count(*)::int AS n FROM usuarios u {where}', params)['n']
    campos = ', '.join(f'u.{c}' for c in CAMPOS_PUBLICOS.split(', '))
    filas = query(
        f"""SELECT {campos},
                   (SELECT count(*)::int FROM intentos i WHERE i.usuario_id = u.id AND i.estado = 'finalizado') AS intentos_finalizados
              FROM usuarios u {where}
             ORDER BY u.fecha_registro DESC, u.id DESC
             LIMIT %s OFFSET %s""",
        [*params, limite, (pagina - 1) * limite],
    )
    return paginado(filas, total, pagina, limite)


def crear(nombre: str, correo: str, password_hash: str, rol: str = 'usuario', estado: str = 'activa',
          acepto_aviso: bool = False, conn: Connection | None = None) -> dict:
    """
    `acepto_aviso` es verdadero cuando el propio titular se registra (RN-23). En
    las cuentas que crea un administrador queda pendiente hasta su primer inicio de sesión.
    """
    sql = f"""INSERT INTO usuarios (nombre, correo, password_hash, rol, estado, fecha_aceptacion_aviso)
              VALUES (%s, %s, %s, %s, %s, CASE WHEN %s THEN now() END) RETURNING {CAMPOS_PUBLICOS}"""
    params = (nombre, correo, password_hash, rol, estado, acepto_aviso)
    if conn:
        return conn.execute(sql, params).fetchone()
    return query_one(sql, params)


_PERMITIDAS = ('nombre', 'correo', 'password_hash', 'rol', 'estado', 'fecha_eliminacion')


def actualizar(id_: int, cambios: dict) -> dict | None:
    """Actualiza solo las columnas presentes en `cambios` (lista blanca)."""
    columnas = [c for c in _PERMITIDAS if c in cambios]
    if not columnas:
        return find_by_id(id_)
    sets = ', '.join(f'{c} = %s' for c in columnas)
    # Cambiar la contraseña invalida los tokens emitidos antes (otras sesiones).
    if 'password_hash' in columnas:
        sets += ', token_version = token_version + 1'
    return query_one(
        f'UPDATE usuarios SET {sets} WHERE id = %s RETURNING {CAMPOS_PUBLICOS}',
        [*(cambios[c] for c in columnas), id_],
    )


def eliminar_logico(id_: int):
    query("UPDATE usuarios SET estado = 'eliminada', fecha_eliminacion = now() WHERE id = %s", (id_,))


def aceptar_aviso(id_: int) -> dict | None:
    return query_one(
        f"""UPDATE usuarios SET fecha_aceptacion_aviso = COALESCE(fecha_aceptacion_aviso, now())
             WHERE id = %s RETURNING {CAMPOS_PUBLICOS}""",
        (id_,),
    )


def anonimizar(conn: Connection, id_: int, password_hash_inutilizable: str) -> dict:
    """
    RN-24: borra nombre y correo, deja la cuenta eliminada y sin acceso. El
    historial de intentos se conserva sin datos que identifiquen al titular.
    """
    conn.execute('DELETE FROM recuperaciones_password WHERE usuario_id = %s', (id_,))
    conn.execute(
        """UPDATE intentos SET estado = 'abandonado', fecha_fin = now()
            WHERE usuario_id = %s AND estado = 'en_curso'""",
        (id_,),
    )
    return conn.execute(
        f"""UPDATE usuarios
               SET nombre = NULL, correo = NULL, password_hash = %s, token_version = token_version + 1,
                   estado = 'eliminada', fecha_eliminacion = COALESCE(fecha_eliminacion, now()),
                   fecha_anonimizacion = now()
             WHERE id = %s RETURNING {CAMPOS_PUBLICOS}""",
        (password_hash_inutilizable, id_),
    ).fetchone()
