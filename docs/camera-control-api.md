# Public camera control API

Camera positions can be prepared in Blender as ordinary named empty nodes and exported with the GLB.

## Named views

```json
{
  "cameraViews": [
    {
      "id": "shelf-bolts",
      "positionNodeName": "CAM_Shelf_Bolts",
      "targetNodeName": "FOCUS_Shelf_Bolts",
      "durationMs": 700
    },
    {
      "id": "back-cross",
      "positionNodeName": "CAM_Back_Cross",
      "targetNodeName": "FOCUS_Back_Cross",
      "durationMs": 1000
    }
  ]
}
```

A camera view is enabled only when both referenced nodes exist in the loaded GLB.

```js
await widget.setCameraView("shelf-bolts");
```

## Focus one or more nodes

The current viewing direction is preserved unless `positionNodeName` is supplied.

```js
await widget.focusOnNode("BoltHole_Left", {
  distance: 0.25,
  durationMs: 700
});

await widget.focusOnNodes(
  ["BoltHole_Left", "BoltHole_Right"],
  {
    positionNodeName: "CAM_Shelf_Bolts",
    padding: 1.25,
    durationMs: 700
  }
);
```

## Restore and cancel

The viewer saves the user camera before the first accepted programmatic camera command. Further camera commands keep the same restore origin until restoration completes.

```js
await widget.restoreCameraView({ durationMs: 700 });
```

An active transition can be stopped at its current interpolated position without stopping model animation or scenario playback:

```js
await widget.cancelCameraTransition();
```

Camera commands are accepted while the widget is ready, while a regular animation is playing, and while a scenario is active. They do not change the selected color or structural variant and do not stop or restart model playback.
