import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Read Supabase configuration from environment variables if provided at build time
  final supabaseUrl = const String.fromEnvironment('SUPABASE_URL', defaultValue: '');
  final supabaseAnonKey = const String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');

  if (supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty) {
    await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final GoRouter router = AppRouter.createRouter();

    final baseTheme = ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6366F1)),
      useMaterial3: true,
    );

    final darkTheme = ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF6366F1),
        brightness: Brightness.dark,
      ),
      useMaterial3: true,
    );

    return MaterialApp.router(
      title: 'ChatTwins',
      theme: baseTheme,
      darkTheme: darkTheme,
      routerConfig: router,
    );
  }
}
