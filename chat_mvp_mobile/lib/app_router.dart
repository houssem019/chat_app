import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'pages/auth_page.dart';
import 'pages/users_list_page.dart';
import 'pages/chat_page.dart';
import 'pages/chats_list_page.dart';
import 'pages/notifications_page.dart';
import 'pages/profile_page.dart';
import 'pages/user_profile_page.dart';

class AppRouter {
  static GoRouter createRouter() {
    return GoRouter(
      routes: <RouteBase>[
        GoRoute(
          path: '/auth',
          builder: (context, state) => const AuthPage(),
        ),
        GoRoute(
          path: '/',
          builder: (context, state) => const UsersListPage(),
        ),
        GoRoute(
          path: '/chats',
          builder: (context, state) => const ChatsListPage(),
        ),
        GoRoute(
          path: '/notifications',
          builder: (context, state) => const NotificationsPage(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfilePage(),
        ),
        GoRoute(
          path: '/u/:username',
          builder: (context, state) {
            final username = state.pathParameters['username']!;
            return UserProfilePage(username: username);
          },
        ),
        GoRoute(
          path: '/chat/:username',
          builder: (context, state) {
            final username = state.pathParameters['username']!;
            return ChatPage(username: username);
          },
        ),
      ],
      errorBuilder: (context, state) => const UsersListPage(),
    );
  }
}
