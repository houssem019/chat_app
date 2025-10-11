# ChatTwins – Profile UI update and Dark Theme

This branch adds two changes:

1. User profile: when viewing someone who is already your friend, the "Friends" label is no longer shown. You will still see the Remove and Chat actions.
2. System-aware dark theme: the site now follows the OS theme using CSS variables and the `prefers-color-scheme` media query. All common components and pages have been updated to use variables.

## Profile UI change

File: `src/pages/UserProfile.jsx`
- When `relationStatus === 'friends'`, the Friends chip was removed; only the Remove button remains alongside Chat.

Impact:
- Cleaner UI on friend profiles; behavior for non-friends stays the same (Add Friend, Pending states, etc.).

## Dark theme

Implemented via CSS variables in `src/index.css`:
- Light defaults are defined under `:root`.
- Dark values are defined under `@media (prefers-color-scheme: dark) { :root { ... } }`.

Key variables (non-exhaustive):
- `--bg-app`, `--bg-page`, `--text-primary`, `--text-secondary`, `--text-muted`
- `--card-bg`, `--card-border`, `--divider`
- `--button-bg`, `--button-text`, `--button-border`, `--button-hover`
- `--brand-primary`, `--brand-primary-hover`, `--brand-primary-disabled`
- `--danger-bg`, `--danger-text`, `--danger-border`
- `--chip-bg`, `--chip-border`, `--chip-text`
- `--placeholder-avatar-bg`, `--placeholder-avatar-text`
- `--input-bg`, `--input-border`, `--muted-surface-bg`, `--subtle-surface-bg`

### Updated components/pages to use variables
- `src/components/Header.jsx` (badge color, header background/border)
- `src/components/Footer.jsx`
- `src/pages/Auth.jsx`
- `src/pages/Chat.jsx`
- `src/pages/ChatsList.jsx`
- `src/pages/Friends.jsx`
- `src/pages/Notifications.jsx`
- `src/pages/Profile.jsx`
- `src/pages/UserProfile.jsx`

### How it works
- If the system theme is dark, the site switches to dark automatically.
- No manual toggle is necessary; it respects OS-level preferences.

### Notes for future development
- When adding new UI, prefer CSS variables over hardcoded colors.
- For chips or semantic states, use the provided variables; extend the set in `index.css` if needed.

## Testing
- On macOS: System Settings → Appearance → Dark; reload the app.
- On Windows/Linux: switch your DE to dark mode or use DevTools → Rendering → Emulate CSS prefers-color-scheme.
- Verify page backgrounds, cards, text colors, buttons, badges, and chat bubbles adapt correctly.
