import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  final SupabaseClient db = Supabase.instance.client;
  List<Map<String, dynamic>> requests = [];
  bool isLoading = true;
  String? actionId;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final user = db.auth.currentUser;
    if (user == null) {
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/auth');
      return;
    }
    await _fetchRequests(user.id);
    setState(() => isLoading = false);
  }

  Future<void> _fetchRequests(String userId) async {
    final res = await db
        .from('friendships')
        .select('id, requester_id, friend_id, status, requester:profiles!friendships_requester_id_fkey(*)')
        .eq('friend_id', userId)
        .eq('status', 'pending');
    requests = (res as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
  }

  Future<void> _accept(String requesterId) async {
    setState(() => actionId = requesterId);
    await db.from('friendships').update({'status': 'accepted'}).match({'requester_id': requesterId, 'friend_id': db.auth.currentUser!.id});
    setState(() => actionId = null);
    await _fetchRequests(db.auth.currentUser!.id);
  }

  Future<void> _remove(String requesterId) async {
    setState(() => actionId = requesterId);
    await db.from('friendships').delete().match({'requester_id': requesterId, 'friend_id': db.auth.currentUser!.id});
    setState(() => actionId = null);
    await _fetchRequests(db.auth.currentUser!.id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: requests.length,
              itemBuilder: (context, index) {
                final r = requests[index];
                final username = (r['requester']?['username'] ?? r['requester']?['full_name'] ?? 'Unknown user').toString();
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundImage: (r['requester']?['avatar_url'] != null && (r['requester']['avatar_url'] as String).isNotEmpty)
                          ? NetworkImage(r['requester']['avatar_url'])
                          : null,
                      child: (r['requester']?['avatar_url'] == null || (r['requester']?['avatar_url'] as String?)?.isEmpty == true)
                          ? Text(username.isNotEmpty ? username[0].toUpperCase() : '?')
                          : null,
                    ),
                    title: Text(username, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('wants to be your friend'),
                    trailing: Wrap(
                      spacing: 8,
                      children: [
                        FilledButton(
                          onPressed: actionId == r['requester_id'] ? null : () => _accept(r['requester_id'] as String),
                          child: Text(actionId == r['requester_id'] ? 'Working…' : 'Accept'),
                        ),
                        OutlinedButton(
                          onPressed: actionId == r['requester_id'] ? null : () => _remove(r['requester_id'] as String),
                          child: const Text('Remove'),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
