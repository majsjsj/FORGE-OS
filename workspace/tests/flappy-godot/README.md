# Flappy Test (Godot 4.4.1)

Tiny offline Flappy-style game: tap to flap, moving pipes, score, game over, retry.
Portrait, touch-first, GL Compatibility renderer. No assets, no ads, no network code.

- Main scene: `main.tscn` (all logic and drawing in `main.gd`)
- Export presets: `android` (debug APK, arm64-v8a) and `web` (single-threaded)
- Best score is stored locally in `user://best.cfg`
