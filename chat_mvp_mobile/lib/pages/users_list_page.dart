import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class UsersListPage extends StatefulWidget {
  const UsersListPage({super.key});

  @override
  State<UsersListPage> createState() => _UsersListPageState();
}

class _UsersListPageState extends State<UsersListPage> {
  final SupabaseClient db = Supabase.instance.client;
  List<dynamic> users = [];
  List<dynamic> filteredUsers = [];
  Map<String, dynamic>? currentUser;
  List<dynamic> friendships = [];
  String filterCountry = '';
  String filterGender = '';
  String filterAgeFrom = '';
  String filterAgeTo = '';
  String? sendingId;
  bool isLoading = true;

  static const int onlineWindowMs = 5 * 60 * 1000;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final authRes = await db.auth.getUser();
    final user = authRes.user;
    if (user == null) {
      if (!mounted) return;
      context.go('/auth');
      return;
    }
    await Future.wait([
      _fetchUsers(excludeId: user.id),
      _fetchFriendships(user.id),
    ]);
    setState(() => isLoading = false);
  }

  Future<void> _fetchUsers({required String excludeId}) async {
    final res = await db.from('profiles').select('*');
    final list = (res as List?) ?? [];
    final withoutMe = list.where((u) => u['id'] != excludeId).toList();
    withoutMe.sort((a, b) {
      final ao = _isUserOnline(a) ? 1 : 0;
      final bo = _isUserOnline(b) ? 1 : 0;
      if (bo != ao) return bo - ao;
      final an = (a['username'] ?? a['full_name'] ?? '').toString().toLowerCase();
      final bn = (b['username'] ?? b['full_name'] ?? '').toString().toLowerCase();
      return an.compareTo(bn);
    });
    setState(() {
      users = withoutMe;
      filteredUsers = List.from(withoutMe);
    });
  }

  Future<void> _fetchFriendships(String userId) async {
    final res = await db
        .from('friendships')
        .select('*')
        .or('requester_id.eq.$userId,friend_id.eq.$userId');
    friendships = (res as List?) ?? [];
  }

  bool _isUserOnline(Map row) {
    final lastStr = row['last_seen_at'] as String?;
    final lastMs = lastStr != null ? DateTime.tryParse(lastStr)?.millisecondsSinceEpoch ?? 0 : 0;
    final withinWindow = lastMs > 0 && DateTime.now().millisecondsSinceEpoch - lastMs <= onlineWindowMs;
    final hasIsOnline = row['is_online'];
    if (hasIsOnline is bool) return hasIsOnline && withinWindow;
    return withinWindow;
  }

  void _applyFilters() {
    var temp = List<Map<String, dynamic>>.from(users.cast());
    if (filterCountry.isNotEmpty) temp = temp.where((u) => (u['country'] ?? '') == filterCountry).toList();
    if (filterAgeFrom.isNotEmpty) temp = temp.where((u) => (int.tryParse('${u['age'] ?? 0}') ?? 0) >= int.parse(filterAgeFrom)).toList();
    if (filterAgeTo.isNotEmpty) temp = temp.where((u) => (int.tryParse('${u['age'] ?? 0}') ?? 0) <= int.parse(filterAgeTo)).toList();
    if (filterGender.isNotEmpty) temp = temp.where((u) => (u['gender'] ?? '').toString().toLowerCase() == filterGender.toLowerCase()).toList();
    temp.sort((a, b) {
      final ao = _isUserOnline(a) ? 1 : 0;
      final bo = _isUserOnline(b) ? 1 : 0;
      if (bo != ao) return bo - ao;
      final an = (a['username'] ?? a['full_name'] ?? '').toString().toLowerCase();
      final bn = (b['username'] ?? b['full_name'] ?? '').toString().toLowerCase();
      return an.compareTo(bn);
    });
    setState(() => filteredUsers = temp);
  }

  Map<String, dynamic>? _relationWith(String userId) {
    for (final f in friendships) {
      if ((f['requester_id'] == db.auth.currentUser?.id && f['friend_id'] == userId) ||
          (f['requester_id'] == userId && f['friend_id'] == db.auth.currentUser?.id)) {
        return Map<String, dynamic>.from(f as Map);
      }
    }
    return null;
  }

  Future<void> _addFriend(String targetId) async {
    final me = db.auth.currentUser;
    if (me == null || targetId == me.id) return;
    final existing = _relationWith(targetId);
    if (existing != null) return;
    setState(() => sendingId = targetId);
    final err = await db
        .from('friendships')
        .insert({'requester_id': me.id, 'friend_id': targetId, 'status': 'pending'});
    setState(() => sendingId = null);
    await _fetchFriendships(me.id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('All Users')),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          Row(children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: filterCountry.isEmpty ? null : filterCountry,
                                items: const [
                                  DropdownMenuItem(value: 'United States', child: Text('United States')),
                                  DropdownMenuItem(value: 'United Kingdom', child: Text('United Kingdom')),
                                  DropdownMenuItem(value: 'India', child: Text('India')),
                                ],
                                onChanged: (v) => setState(() => filterCountry = v ?? ''),
                                decoration: const InputDecoration(labelText: 'Country'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: filterAgeFrom.isEmpty ? null : filterAgeFrom,
                                items: List.generate(83, (i) => 18 + i)
                                    .map((a) => DropdownMenuItem(value: '$a', child: Text('$a')))
                                    .toList(),
                                onChanged: (v) => setState(() => filterAgeFrom = v ?? ''),
                                decoration: const InputDecoration(labelText: 'Age from'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: filterAgeTo.isEmpty ? null : filterAgeTo,
                                items: List.generate(83, (i) => 18 + i)
                                    .map((a) => DropdownMenuItem(value: '$a', child: Text('$a')))
                                    .toList(),
                                onChanged: (v) => setState(() => filterAgeTo = v ?? ''),
                                decoration: const InputDecoration(labelText: 'Age to'),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 8),
                          Row(children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: filterGender.isEmpty ? null : filterGender,
                                items: const [
                                  DropdownMenuItem(value: 'male', child: Text('Male')),
                                  DropdownMenuItem(value: 'female', child: Text('Female')),
                                  DropdownMenuItem(value: 'other', child: Text('Other')),
                                ],
                                onChanged: (v) => setState(() => filterGender = v ?? ''),
                                decoration: const InputDecoration(labelText: 'Gender'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            FilledButton(
                              onPressed: _applyFilters,
                              child: const Text('Apply Filters'),
                            ),
                          ]),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: GridView.builder(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 1,
                        mainAxisSpacing: 8,
                        childAspectRatio: 4,
                      ),
                      itemCount: filteredUsers.length,
                      itemBuilder: (context, index) {
                        final u = filteredUsers[index] as Map<String, dynamic>;
                        final rel = _relationWith(u['id'] as String);
                        final isSelf = db.auth.currentUser?.id == u['id'];
                        if (isSelf == true) return const SizedBox.shrink();
                        final online = _isUserOnline(u);
                        final displayName = (u['username'] ?? u['full_name'] ?? 'No Name').toString();
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                Stack(
                                  children: [
                                    CircleAvatar(
                                      radius: 24,
                                      backgroundImage: (u['avatar_url'] != null && (u['avatar_url'] as String).isNotEmpty)
                                          ? NetworkImage(u['avatar_url'])
                                          : null,
                                      child: (u['avatar_url'] == null || (u['avatar_url'] as String).isEmpty)
                                          ? Text(displayName[0].toUpperCase())
                                          : null,
                                    ),
                                    if (online)
                                      Positioned(
                                        left: 0,
                                        top: 0,
                                        child: Container(
                                          width: 12,
                                          height: 12,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF22c55e),
                                            shape: BoxShape.circle,
                                            border: Border.all(color: Theme.of(context).cardColor, width: 2),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(displayName, style: const TextStyle(fontWeight: FontWeight.w600)),
                                      Text(
                                        '${u['country'] ?? 'Unknown country'}'
                                        '${u['age'] != null ? ' · ${u['age']}' : ''}'
                                        '${u['gender'] != null ? ' · ${u['gender']}' : ''}',
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                                if (rel != null)
                                  (rel['status'] == 'pending')
                                      ? (rel['requester_id'] == db.auth.currentUser?.id
                                          ? const Padding(
                                              padding: EdgeInsets.symmetric(horizontal: 8),
                                              child: Chip(label: Text('Request Sent')),
                                            )
                                          : Padding(
                                              padding: const EdgeInsets.symmetric(horizontal: 8),
                                              child: FilledButton(
                                                onPressed: () => context.go('/notifications'),
                                                child: const Text('Respond'),
                                              ),
                                            ))
                                      : const Padding(
                                          padding: EdgeInsets.symmetric(horizontal: 8),
                                          child: Chip(label: Text('Friends')),
                                        )
                                else
                                  Row(
                                    children: [
                                      OutlinedButton(
                                        onPressed: () => context.go('/chat/${u['username']}'),
                                        child: const Text('Chat'),
                                      ),
                                      const SizedBox(width: 8),
                                      FilledButton(
                                        onPressed: sendingId == u['id'] ? null : () => _addFriend(u['id'] as String),
                                        child: Text(sendingId == u['id'] ? 'Sending…' : 'Add Friend'),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
