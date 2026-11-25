# Flap Gate 3D Lite (Godot 4.4)

Original portrait arcade flyer for validating FORGE's Godot 3D pipeline.

- True 3D scene with procedural BoxMesh and SphereMesh geometry.
- Orthographic side camera with gentle follow and tilt.
- Touch, mouse and keyboard controls.
- Randomized gates, collision, score, best score and retry.
- No imported textures, audio, fonts, plugins, network calls or external assets.
- GL Compatibility renderer and mobile-oriented settings.

## Size acceptance
The hard acceptance limit is **10 MB for the exported Android APK**. This is a target, not a measured result. Build and measure the APK before claiming it passes. The test preset should use ARMv7 only to minimize size; it is not a universal device release.

## Build
Use the FORGE on-demand Godot workflow with this project path and the Android preset. Keep the artifact only if the measured APK is below 10 MB. No build is triggered by committing these source files.
