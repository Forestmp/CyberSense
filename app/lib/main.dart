import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'router.dart';
import 'state/auth.dart';
import 'theme.dart';
import 'widgets/avisos.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es_MX');
  final auth = Auth()..restaurar();
  runApp(ChangeNotifierProvider.value(value: auth, child: CyberSenseApp(auth: auth)));
}

class CyberSenseApp extends StatefulWidget {
  const CyberSenseApp({super.key, required this.auth});
  final Auth auth;

  @override
  State<CyberSenseApp> createState() => _CyberSenseAppState();
}

class _CyberSenseAppState extends State<CyberSenseApp> {
  late final _router = crearRouter(widget.auth);

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'CyberSense',
      debugShowCheckedModeBanner: false,
      theme: temaCyberSense(),
      scaffoldMessengerKey: avisosKey,
      routerConfig: _router,
    );
  }
}
