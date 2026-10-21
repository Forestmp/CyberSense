/** Reglas de contraseña: las mismas que valida la API. */
export const reglasPassword = (p) => [
  { ok: p.length >= 8, texto: 'Al menos 8 caracteres' },
  { ok: /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p), texto: 'Al menos una letra' },
  { ok: /\d/.test(p), texto: 'Al menos un número' },
];

export const passwordValida = (p) => reglasPassword(p).every((r) => r.ok);

export const correoValido = (c) => /^\S+@\S+\.\S+$/.test(c.trim());
