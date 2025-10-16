import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ChatPage extends StatefulWidget {
  final String username;
  const ChatPage({super.key, required this.username});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final SupabaseClient db = Supabase.instance.client;
  final TextEditingController messageController = TextEditingController();
  final ScrollController scrollController = ScrollController();
  List<Map<String, dynamic>> messages = [];
  Map<String, dynamic>? myProfile;
  Map<String, dynamic>? otherProfile;
  bool isSending = false;
  File? pickedImage;
  String? imagePreviewPath;

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
    final other = await db.from('profiles').select('*').eq('username', widget.username).maybeSingle();
    if (other == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('User not found')));
      context.go('/');
      return;
    }
    otherProfile = Map<String, dynamic>.from(other);
    final me = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (me != null) myProfile = Map<String, dynamic>.from(me);
    await _fetchMessages(user.id, otherProfile!['id'] as String);
  }

  Future<void> _fetchMessages(String myId, String otherId) async {
    final res = await db
        .from('messages')
        .select('*')
        .or('and(sender_id.eq.$myId,receiver_id.eq.$otherId),and(sender_id.eq.$otherId,receiver_id.eq.$myId)')
        .order('created_at', ascending: true);
    final list = (res as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
    setState(() => messages = list);
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scrollController.hasClients) {
        scrollController.animateTo(
          scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) {
      setState(() {
        pickedImage = null;
        imagePreviewPath = null;
      });
      return;
    }
    setState(() {
      pickedImage = File(picked.path);
      imagePreviewPath = picked.path;
    });
  }

  Future<void> _sendMessage() async {
    if (otherProfile == null || db.auth.currentUser == null) return;
    final trimmed = messageController.text.trim();
    if (trimmed.isEmpty && pickedImage == null) return;

    setState(() => isSending = true);

    String? publicUrl;
    if (pickedImage != null) {
      final name = pickedImage!.path.split('/').last;
      final filePath = 'messages/${db.auth.currentUser!.id}/${DateTime.now().millisecondsSinceEpoch}_$name';
      await db.storage.from('chat-uploads').upload(filePath, pickedImage!);
      final pub = await db.storage.from('chat-uploads').getPublicUrl(filePath);
      publicUrl = pub;
    }

    final inserted = await db
        .from('messages')
        .insert({
          'sender_id': db.auth.currentUser!.id,
          'receiver_id': otherProfile!['id'],
          'content': trimmed.isEmpty ? null : trimmed,
          'image_url': publicUrl,
        })
        .select()
        .maybeSingle();

    if (inserted != null) {
      setState(() {
        messages.add(Map<String, dynamic>.from(inserted));
        messageController.clear();
        pickedImage = null;
        imagePreviewPath = null;
      });
      _scrollToBottom();
    }

    setState(() => isSending = false);
  }

  @override
  Widget build(BuildContext context) {
    final headerName = (otherProfile?['username'] ?? otherProfile?['full_name'] ?? 'Chat').toString();
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundImage: (otherProfile?['avatar_url'] != null && (otherProfile!['avatar_url'] as String).isNotEmpty)
                  ? NetworkImage(otherProfile!['avatar_url'])
                  : null,
              child: (otherProfile?['avatar_url'] == null || (otherProfile?['avatar_url'] as String?)?.isEmpty == true)
                  ? Text(headerName.isNotEmpty ? headerName[0].toUpperCase() : '?')
                  : null,
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => context.go('/u/${widget.username}')
              ,
              child: Text(headerName, style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => context.go('/u/${widget.username}'),
            child: const Text('View Profile'),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final message = messages[index];
                final isMine = message['sender_id'] == db.auth.currentUser?.id;
                final bubbleColor = isMine ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.surfaceContainerHighest;
                final textColor = isMine ? Colors.white : Theme.of(context).colorScheme.onSurface;
                final align = isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start;
                return Column(
                  crossAxisAlignment: align,
                  children: [
                    Container(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      constraints: const BoxConstraints(maxWidth: 480),
                      decoration: BoxDecoration(
                        color: bubbleColor,
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(isMine ? 14 : 4),
                          topRight: Radius.circular(isMine ? 4 : 14),
                          bottomLeft: const Radius.circular(14),
                          bottomRight: const Radius.circular(14),
                        ),
                        border: Border.all(color: isMine ? Theme.of(context).colorScheme.primary : Theme.of(context).dividerColor),
                        boxShadow: const [BoxShadow(blurRadius: 1, color: Colors.black12)],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (message['content'] != null)
                            Text(
                              message['content'] as String,
                              style: TextStyle(color: textColor),
                            ),
                          if (message['image_url'] != null)
                            Padding(
                              padding: EdgeInsets.only(top: message['content'] != null ? 8 : 0),
                              child: Image.network(message['image_url'] as String),
                            ),
                          const SizedBox(height: 4),
                          Text(
                            (message['created_at'] ?? '').toString(),
                            style: TextStyle(color: textColor.withOpacity(0.8), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Row(
                children: [
                  if (imagePreviewPath != null)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Stack(
                        alignment: Alignment.topRight,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: Image.file(File(imagePreviewPath!), width: 40, height: 40, fit: BoxFit.cover),
                          ),
                          InkWell(
                            onTap: () => setState(() {
                              pickedImage = null;
                              imagePreviewPath = null;
                            }),
                            child: const CircleAvatar(radius: 9, child: Icon(Icons.close, size: 12)),
                          )
                        ],
                      ),
                    ),
                  IconButton(
                    onPressed: _pickImage,
                    icon: const Icon(Icons.attach_file),
                  ),
                  Expanded(
                    child: TextField(
                      controller: messageController,
                      minLines: 1,
                      maxLines: 4,
                      decoration: const InputDecoration(hintText: 'Type a message'),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: isSending || (messageController.text.trim().isEmpty && pickedImage == null) ? null : _sendMessage,
                    child: Text(isSending ? 'Sending…' : 'Send'),
                  ),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
