"""
Reglas de integridad del grafo de un escenario que no se pueden expresar
con restricciones de la BD: referencias por clave, paso inicial único,
pasos alcanzables y ausencia de ciclos (un intento no puede repetir paso).
Recibe el documento con la forma del payload de POST /api/scenarios.
Devuelve una lista de mensajes de error (vacía = válido).
"""


def validar_estructura(doc: dict) -> list[str]:
    errores: list[str] = []
    pasos = doc.get('pasos') or []
    senales = doc.get('senales') or []
    claves_paso: set[str] = set()
    claves_opcion: set[str] = set()
    claves_senal = {s['clave'] for s in senales}

    if len(senales) != len(claves_senal):
        errores.append('Hay señales de alerta con clave repetida')

    for p in pasos:
        if p['clave'] in claves_paso:
            errores.append(f"Paso con clave repetida: {p['clave']}")
        claves_paso.add(p['clave'])

    iniciales = [p for p in pasos if p.get('es_inicial')]
    if len(iniciales) != 1:
        errores.append('El escenario debe tener exactamente un paso inicial')

    for p in pasos:
        opciones = p.get('opciones') or []
        if len(opciones) < 2:
            errores.append(f"El paso {p['clave']} debe tener al menos 2 opciones")
        for o in opciones:
            if o['clave'] in claves_opcion:
                errores.append(f"Opción con clave repetida en el escenario: {o['clave']}")
            claves_opcion.add(o['clave'])
            sig = o.get('siguiente_paso')
            if sig is not None and sig not in claves_paso:
                errores.append(f"La opción {o['clave']} apunta a un paso inexistente: {sig}")
            if sig == p['clave']:
                errores.append(f"La opción {o['clave']} apunta a su propio paso")
            for s in o.get('senales') or []:
                if s not in claves_senal:
                    errores.append(f"La opción {o['clave']} referencia una señal inexistente: {s}")

    for r in doc.get('reglas') or []:
        params = r.get('parametros') or {}
        refs = ([params.get('opcion')] if r['tipo_regla'] == 'OPCION_SELECCIONADA'
                else params.get('opciones') or [] if r['tipo_regla'] == 'SECUENCIA' else [])
        for ref in refs:
            if ref not in claves_opcion:
                errores.append(f"La regla \"{r['descripcion']}\" referencia una opción inexistente: {ref}")

    if errores or len(iniciales) != 1:
        return errores

    # Recorrido en profundidad desde el paso inicial: detecta ciclos y pasos inalcanzables.
    por_clave = {p['clave']: p for p in pasos}
    estado: dict[str, int] = {}  # 1 = en recorrido, 2 = terminado

    def visitar(clave: str) -> bool:
        if estado.get(clave) == 1:
            return True
        if estado.get(clave) == 2:
            return False
        estado[clave] = 1
        for o in por_clave[clave]['opciones']:
            if o.get('siguiente_paso') is not None and visitar(o['siguiente_paso']):
                return True
        estado[clave] = 2
        return False

    if visitar(iniciales[0]['clave']):
        errores.append('Los pasos forman un ciclo; el escenario debe poder terminar siempre')
    for p in pasos:
        if p['clave'] not in estado:
            errores.append(f"El paso {p['clave']} no es alcanzable desde el paso inicial")
    return errores
