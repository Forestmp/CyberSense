import 'package:flutter/material.dart';

import '../api/client.dart';
import '../theme.dart';
import '../util/formatos.dart';
import 'ui.dart';

/// Representa el contenido ficticio de un paso. Los enlaces y botones se
/// dibujan, pero nunca son interactivos: las decisiones se toman con las
/// opciones de abajo.
class ContenidoSimulado extends StatelessWidget {
  const ContenidoSimulado(this.contenido, {super.key});
  final Json? contenido;

  @override
  Widget build(BuildContext context) {
    final c = contenido ?? const <String, dynamic>{};
    return switch (c['formato']) {
      'correo' => _Correo(c),
      'sms' || 'mensaje_chat' => _Sms(c),
      'sitio_web' => _SitioWeb(c),
      'llamada' => _Llamada(c),
      'detalle_remitente' => _Detalle(c, [
          ('Nombre visible', c['remitente_nombre']),
          ('Dirección de correo', c['remitente_correo']),
          ('Dominio', c['dominio']),
        ]),
      'detalle_url' => _Detalle(c, [
          ('Dirección completa', c['url']),
          ('Dominio real', c['dominio_real']),
          ('Conexión', c['usa_https'] == null ? null : c['usa_https'] == true ? 'Segura (HTTPS)' : 'No segura (HTTP)'),
        ]),
      'texto' => _Marco(child: Text('${c['texto'] ?? ''}', style: _cuerpo)),
      _ => _generico(c),
    };
  }

  Widget _generico(Json c) {
    final campos = formatos[c['formato']]?.campos.map((f) => (f.label, f.clave)) ??
        c.keys.where((k) => k != 'formato').map((k) => (k, k));
    return _Detalle(const {}, [
      for (final (label, clave) in campos) (label, c[clave] is List ? (c[clave] as List).join(', ') : c[clave]),
    ]);
  }
}

final _cuerpo = inter(size: 15, height: 22);
final _tenue = inter(size: 13, color: C.textMuted);
final _negrita = inter(size: 15, weight: FontWeight.w700);
final _asunto = inter(size: 17, weight: FontWeight.w700);
final _etiquetaCampo = inter(size: 13, weight: FontWeight.w600, color: C.textMuted);

class _Marco extends StatelessWidget {
  const _Marco({required this.child, this.color = C.surface, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final Color color;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(R.lg),
          border: Border.all(color: C.border),
          boxShadow: Sombra.sm,
        ),
        child: child,
      );
}

class _BotonFalso extends StatelessWidget {
  const _BotonFalso(this.texto);
  final String texto;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        margin: const EdgeInsets.only(top: 4),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.sm)),
        child: Text(texto, style: inter(weight: FontWeight.w700, color: Colors.white)),
      );
}

class _Avatar extends StatelessWidget {
  const _Avatar(this.texto, {this.tamano = 40});
  final String texto;
  final double tamano;

  @override
  Widget build(BuildContext context) => Container(
        width: tamano,
        height: tamano,
        alignment: Alignment.center,
        decoration: const BoxDecoration(color: C.primarySoft, shape: BoxShape.circle),
        child: Text(texto, style: inter(size: 18, weight: FontWeight.w700, color: C.navy)),
      );
}

String? _s(Object? v) => v == null || '$v'.isEmpty ? null : '$v';

class _Correo extends StatelessWidget {
  const _Correo(this.c);
  final Json c;

  @override
  Widget build(BuildContext context) {
    final inicial = (_s(c['remitente_nombre']) ?? _s(c['remitente_correo']) ?? '?')[0].toUpperCase();
    return _Marco(
      child: Col(gap: 8, children: [
        Row(children: [
          _Avatar(inicial),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_s(c['remitente_nombre']) ?? '', style: _negrita, maxLines: 1, overflow: TextOverflow.ellipsis),
              if (_s(c['remitente_correo']) != null)
                Text('<${c['remitente_correo']}>', style: _tenue, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
          if (_s(c['fecha']) != null) Text('${c['fecha']}', style: _tenue),
        ]),
        if (_s(c['asunto']) != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('${c['asunto']}', style: _asunto)),
        if (_s(c['cuerpo']) != null) Text('${c['cuerpo']}', style: _cuerpo),
        if (_s(c['enlace_texto']) != null) _BotonFalso('${c['enlace_texto']}'),
        if (_s(c['enlace_url']) != null) Text('${c['enlace_url']}', style: inter(size: 12, color: C.textMuted), maxLines: 2),
      ]),
    );
  }
}

class _Sms extends StatelessWidget {
  const _Sms(this.c);
  final Json c;

  @override
  Widget build(BuildContext context) {
    return _Marco(
      color: C.bg,
      child: Col(gap: 4, children: [
        Text(_s(c['remitente']) ?? _s(c['aplicacion']) ?? '', style: _negrita, textAlign: TextAlign.center),
        if (_s(c['aplicacion']) != null && _s(c['remitente']) != null)
          Text('${c['aplicacion']}', style: _tenue, textAlign: TextAlign.center),
        if (_s(c['fecha']) != null) Text('${c['fecha']}', style: _tenue, textAlign: TextAlign.center),
        Align(
          alignment: Alignment.centerLeft,
          child: FractionallySizedBox(
            widthFactor: 0.9,
            alignment: Alignment.centerLeft,
            child: Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                color: Color(0xFFE5E7EB),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(4),
                  topRight: Radius.circular(18),
                  bottomLeft: Radius.circular(18),
                  bottomRight: Radius.circular(18),
                ),
              ),
              child: Col(gap: 4, children: [
                Text(_s(c['mensaje']) ?? '', style: _cuerpo),
                if (_s(c['enlace_url']) != null)
                  Text('${c['enlace_url']}',
                      style: _cuerpo.copyWith(color: C.primary, decoration: TextDecoration.underline)),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

class _SitioWeb extends StatelessWidget {
  const _SitioWeb(this.c);
  final Json c;

  @override
  Widget build(BuildContext context) {
    final url = _s(c['url']) ?? '';
    final inseguro = url.startsWith('http://');
    final campos = c['campos'] is List ? (c['campos'] as List).map((x) => '$x').toList() : <String>[];
    return _Marco(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: const BoxDecoration(color: C.neutralSoft, border: Border(bottom: BorderSide(color: C.border))),
          child: Row(children: [
            inseguro
                ? Text('No seguro', style: inter(size: 12, weight: FontWeight.w700, color: C.danger))
                : const Icon(Icons.lock, size: 14, color: C.textMuted),
            const SizedBox(width: 8),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.pill)),
                child: Text(url, style: inter(size: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Col(gap: 12, children: [
            if (_s(c['titulo_pagina']) != null) Text('${c['titulo_pagina']}', style: _asunto),
            if (_s(c['mensaje']) != null) Text('${c['mensaje']}', style: _cuerpo),
            for (final campo in campos)
              Col(gap: 4, children: [
                Text(campo, style: _etiquetaCampo),
                Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFAFAFA),
                    border: Border.all(color: C.border),
                    borderRadius: BorderRadius.circular(R.sm),
                  ),
                ),
              ]),
            if (campos.isNotEmpty) const _BotonFalso('Continuar'),
          ]),
        ),
      ]),
    );
  }
}

class _Llamada extends StatelessWidget {
  const _Llamada(this.c);
  final Json c;

  @override
  Widget build(BuildContext context) => _Marco(
        child: Col(gap: 8, cross: CrossAxisAlignment.center, children: [
          const _Avatar('☎', tamano: 56),
          Text(_s(c['llamante']) ?? '', style: _negrita),
          if (_s(c['numero']) != null) Text('${c['numero']}', style: _tenue),
          if (_s(c['transcripcion']) != null)
            Text('“${c['transcripcion']}”', style: _cuerpo.copyWith(fontStyle: FontStyle.italic), textAlign: TextAlign.center),
        ]),
      );
}

class _Detalle extends StatelessWidget {
  const _Detalle(this.c, this.filas);
  final Json c;
  final List<(String, Object?)> filas;

  @override
  Widget build(BuildContext context) => _Marco(
        child: Col(gap: 10, children: [
          for (final (k, v) in filas)
            if (_s(v) != null)
              Col(gap: 2, children: [Text(k, style: _etiquetaCampo), Text('$v', style: _cuerpo)]),
          if (_s(c['nota']) != null)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: C.warningSoft, borderRadius: BorderRadius.circular(R.md)),
              child: Text('${c['nota']}', style: inter(size: 15, height: 20)),
            ),
        ]),
      );
}
