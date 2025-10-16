import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class UserProfilePage extends StatefulWidget {
  final String username;
  const UserProfilePage({super.key, required this.username});

  @override
  State<UserProfilePage> createState() => _UserProfilePageState();
}

class _UserProfilePageState extends State<UserProfilePage> {
  final SupabaseClient db = Supabase.instance.client;
  Map<String, dynamic>? profile;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await db.from('profiles').select('*').eq('username', widget.username).maybeSingle();
    if (res != null) setState(() => profile = Map<String, dynamic>.from(res));
  }

  @override
  Widget build(BuildContext context) {
    final name = (profile?['username'] ?? profile?['full_name'] ?? 'User').toString();
    return Scaffold(
      appBar: AppBar(title: Text(name)),
      body: profile == null
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 32,
                        backgroundImage: (profile?['avatar_url'] != null && (profile!['avatar_url'] as String).isNotEmpty)
                            ? NetworkImage(profile!['avatar_url'])
                            : null,
                        child: (profile?['avatar_url'] == null || (profile?['avatar_url'] as String).isEmpty)
                            ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?')
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text('Country: ${profile?['country'] ?? 'Unknown'}'),
                  const SizedBox(height: 8),
                  Text('Age: ${profile?['age'] ?? 'N/A'}'),
                  const SizedBox(height: 8),
                  Text('Gender: ${profile?['gender'] ?? 'N/A'}'),
                ],
              ),
            ),
    );
  }
}
