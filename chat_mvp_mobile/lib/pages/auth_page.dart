import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  bool isSubmitting = false;
  bool isLogin = true;

  Future<void> handleAuth() async {
    setState(() => isSubmitting = true);
    try {
      if (isLogin) {
        final response = await Supabase.instance.client.auth.signInWithPassword(
          email: emailController.text.trim(),
          password: passwordController.text,
        );
        final user = response.user;
        if (user == null) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Login failed')),
          );
          return;
        }
        // Decide landing based on profile completion
        final profile = await Supabase.instance.client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
        if ((profile == null) || (profile['username'] == null) || (profile['full_name'] == null)) {
          if (!mounted) return;
          context.go('/profile');
        } else {
          if (!mounted) return;
          context.go('/');
        }
      } else {
        final res = await Supabase.instance.client.auth.signUp(
          email: emailController.text.trim(),
          password: passwordController.text,
        );
        if (res.user != null) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Signup successful! Please confirm your email.')),
          );
          setState(() => isLogin = true);
        }
      }
    } on AuthException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } finally {
      if (mounted) setState(() => isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Text('Chat', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
                      Text('Twins', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: Color(0xFF6366F1))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    isLogin ? 'Welcome back to ChatTwins' : 'Join ChatTwins',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: emailController,
                    decoration: const InputDecoration(labelText: 'Email'),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: passwordController,
                    decoration: const InputDecoration(labelText: 'Password'),
                    obscureText: true,
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: isSubmitting || emailController.text.isEmpty || passwordController.text.isEmpty
                        ? null
                        : handleAuth,
                    child: Text(isSubmitting ? 'Please wait…' : (isLogin ? 'Login' : 'Signup')),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => setState(() => isLogin = !isLogin),
                    child: Text(isLogin ? 'No account? Signup' : 'Already have an account? Login'),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'By continuing you agree to ChatTwins.com terms.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
