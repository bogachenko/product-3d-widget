# Configurable ordinary pose

Approved project decision from 2026-08-01:

- `restPose` is optional and may reference the endpoint of a configured regular animation.
- Without `restPose`, the primary GLB base pose remains the ordinary pose.
- Invalid static or model-bound `restPose` configuration is a local capability error and falls back to the GLB base pose.
- The same ordinary pose is displayed before `STATE-READY` and restored after regular animation completion, animation interruption, scenario stop, accepted scenario failure, and WebGL recovery.
- Color, structural selection and camera remain preserved according to the existing contracts.

This decision is implemented inside the existing configuration and Three.js viewer boundaries. It adds no runtime module or dependency.
