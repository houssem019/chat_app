import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final SupabaseClient db = Supabase.instance.client;
  final TextEditingController usernameController = TextEditingController();
  final TextEditingController fullNameController = TextEditingController();
  final TextEditingController countryController = TextEditingController();
  final TextEditingController ageController = TextEditingController();
  final TextEditingController genderController = TextEditingController();
  bool isSaving = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final user = db.auth.currentUser;
    if (user == null) return;
    final profile = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profile != null) {
      usernameController.text = (profile['username'] ?? '').toString();
      fullNameController.text = (profile['full_name'] ?? '').toString();
      countryController.text = (profile['country'] ?? '').toString();
      ageController.text = (profile['age'] ?? '').toString();
      genderController.text = (profile['gender'] ?? '').toString();
    }
  }

  Future<void> _save() async {
    final user = db.auth.currentUser;
    if (user == null) return;
    setState(() => isSaving = true);
    await db.from('profiles').upsert({
      'id': user.id,
      'username': usernameController.text.trim(),
      'full_name': fullNameController.text.trim(),
      'country': countryController.text.trim(),
      'age': int.tryParse(ageController.text.trim()),
      'gender': genderController.text.trim(),
    });
    setState(() => isSaving = false);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile saved')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')), 
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: usernameController, decoration: const InputDecoration(labelText: 'Username')),
          const SizedBox(height: 8),
          TextField(controller: fullNameController, decoration: const InputDecoration(labelText: 'Full name')),
          const SizedBox(height: 8),
          TextField(controller: countryController, decoration: const InputDecoration(labelText: 'Country')),
          const SizedBox(height: 8),
          TextField(controller: ageController, decoration: const InputDecoration(labelText: 'Age'), keyboardType: TextInputType.number),
          const SizedBox(height: 8),
          TextField(controller: genderController, decoration: const InputDecoration(labelText: 'Gender')),
          const SizedBox(height: 16),
          FilledButton(onPressed: isSaving ? null : _save, child: Text(isSaving ? 'Saving…' : 'Save')),
        ],
      ),
    );
  }
}
