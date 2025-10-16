import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ChatsListPage extends StatefulWidget {
  const ChatsListPage({super.key});

  @override
  State<ChatsListPage> createState() => _ChatsListPageState();
}

class _ChatsListPageState extends State<ChatsListPage> {
  final SupabaseClient db = Supabase.instance.client;
  Map<String, dynamic>? currentUser;
  List<Map<String, dynamic>> chats = [];
  Map<String, dynamic> latestByPartner = {};
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final user = db.auth.currentUser;
    if (user == null) {
      if (!mounted) return;
      context.go('/auth');
      return;
    }
    currentUser = {'id': user.id};
    await _fetchChats(user.id);
    setState(() => isLoading = false);
  }

  Future<void> _fetchChats(String userId) async {
    final msgPairs = await db
        .from('messages')
        .select('sender_id, receiver_id, created_at')
        .or('sender_id.eq.$userId,receiver_id.eq.$userId');
    final pairs = (msgPairs as List?) ?? [];
    final userIds = pairs
        .map((m) => (m['sender_id'] == userId ? m['receiver_id'] : m['sender_id']).toString())
        .toSet()
        .toList();

    if (userIds.isEmpty) {
      chats = [];
      latestByPartner = {};
      return;
    }

    final latestMsgs = await db
        .from('messages')
        .select('*')
        .or('sender_id.eq.$userId,receiver_id.eq.$userId')
        .order('created_at', ascending: false)
        .limit(500);

    latestByPartner = {};
    for (final m in (latestMsgs as List?) ?? []) {
      final partnerId = m['sender_id'] == userId ? m['receiver_id'] : m['sender_id'];
      latestByPartner.putIfAbsent('$partnerId', () => m);
    }

    final users = await db.from('profiles').select('*').inFilter('id', userIds);
    chats = (users as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
  }

  Future<void> _deleteChat(String partnerId) async {
    final me = db.auth.currentUser;
    if (me == null) return;
    try {
      await db
          .from('messages')
          .delete()
          .or('and(sender_id.eq.${me.id},receiver_id.eq.$partnerId),and(sender_id.eq.$partnerId,receiver_id.eq.${me.id})');
      setState(() {
        chats.removeWhere((c) => c['id'] == partnerId);
        latestByPartner.remove(partnerId);
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to delete chat.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Chats')),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: chats.length,
              itemBuilder: (context, index) {
                final user = chats[index];
                final latest = latestByPartner[user['id']];
                final lastOpenedIso = latest != null ? null : null; // Simplified for mobile
                final hasUnread = false; // Simplified
                final displayName = (user['username'] ?? user['full_name'] ?? '').toString();
                return Card(
                  child: ListTile(
                    onTap: () => context.go('/chat/${user['username']}'),
                    leading: CircleAvatar(
                      backgroundImage: (user['avatar_url'] != null && (user['avatar_url'] as String).isNotEmpty)
                          ? NetworkImage(user['avatar_url'])
                          : null,
                      child: (user['avatar_url'] == null || (user['avatar_url'] as String).isEmpty)
                          ? Text(displayName.isNotEmpty ? displayName[0].toUpperCase() : '?')
                          : null,
                    ),
                    title: Row(children: [
                      Text(displayName),
                      const SizedBox(width: 8),
                      if (hasUnread)
                        const SizedBox(
                          width: 8,
                          height: 8,
                          child: DecoratedBox(
                            decoration: BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                          ),
                        ),
                    ]),
                    trailing: IconButton(
                      icon: const Icon(Icons.close, color: Colors.red),
                      onPressed: () => _deleteChat('${user['id']}'),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
