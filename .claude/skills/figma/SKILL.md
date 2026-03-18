---
name: figma
description: Interact with a Figma file through the local Claude-Figma bridge. Use when asked to read, inspect, or edit Figma designs — e.g. "change the button color", "create a frame", "what's selected in Figma?", "update the heading text".
allowed-tools: Bash
---

You have access to a local bridge server that connects Claude Code to an open Figma file.

## Prerequisites

Before any command, verify the bridge is running and the Figma plugin is connected:

```bash
curl -s http://localhost:3056/status
```

Expected: `{"connected":true}`. If not connected:
- Start the bridge: `cd bridge && npm start` (runs in background or a separate terminal)
- Open the Figma plugin: Plugins → Development → Claude Code Bridge

## Bridge API

**Base URL:** `http://localhost:3056`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/status` | GET | Check plugin connection |
| `/page` | GET | Get current page + top-level nodes |
| `/selection` | GET | Get currently selected nodes |
| `/command` | POST | Send any command (JSON body) |

## Commands Reference

All commands go to `POST /command` with `Content-Type: application/json`.

### Read

```bash
# Get current page info and top-level children
curl -s http://localhost:3056/page

# Get selected nodes
curl -s http://localhost:3056/selection

# Get a node by ID (includes reactions if node has prototype interactions)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"get-node","nodeId":"<id>"}'

# List children of a node (omit parentId for current page)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"list-nodes","parentId":"<id>"}'

# List local styles (paint, text, effect)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"get-styles"}'
```

#### Node response fields

`get-node` and `list-nodes` return serialized nodes with:

```
id, name, type, x, y, width, height
opacity, visible, locked, blendMode, rotation
fills, strokes, strokeWeight, strokeAlign
effects, cornerRadius, constraints
layoutMode, primaryAxisAlignItems, counterAxisAlignItems
itemSpacing, paddingTop, paddingBottom, paddingLeft, paddingRight
layoutSizingHorizontal, layoutSizingVertical
layoutAlign, layoutGrow, layoutPositioning
childCount
reactions        (prototype interactions — see below)

TEXT only:
  characters, fontSize, fontName, textAlignHorizontal, textAutoResize
```

#### Reactions (prototype interactions)

`get-node` returns a `reactions` array when the node has prototype interactions. Each reaction:

```json
{
  "trigger": {
    "type": "MOUSE_ENTER"
    // AFTER_TIMEOUT also has: "timeout": <seconds as float>
  },
  "action": {
    "type": "NODE",
    "destinationId": "<target frame id>",
    "transition": {
      "type": "SMART_ANIMATE",
      "duration": 0.2,
      "easing": { "type": "EASE_OUT" }
    }
  }
}
```

**Trigger types:** `MOUSE_ENTER` | `MOUSE_LEAVE` | `AFTER_TIMEOUT` | `ON_CLICK` | `ON_PRESS`

**Transition types:** `SMART_ANIMATE` | `DISSOLVE` | `MOVE_IN` | `MOVE_OUT` | `PUSH` | `SLIDE_IN` | `SLIDE_OUT` | `null` (instant)

**Easing types:** `EASE_OUT` | `EASE_IN` | `EASE_IN_AND_OUT` | `LINEAR` | `CUSTOM_CUBIC_BEZIER`

`action.transition` is `null` for instant transitions — always check it exists before reading fields.

---

### Text

```bash
# Set text content
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-text","nodeId":"<id>","value":"Hello World"}'

# Create a text node (all params except characters are optional)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"create-text","characters":"Hello","x":100,"y":100,"fontSize":16,"parentId":"<id>"}'

# Set font family, style, and size
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-font","nodeId":"<id>","family":"Inter","style":"Bold","fontSize":24}'

# Set text style properties (all optional, mix as needed)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{
    "type": "set-text-style",
    "nodeId": "<id>",
    "textAlignHorizontal": "LEFT",
    "textAlignVertical": "TOP",
    "textAutoResize": "HEIGHT",
    "textCase": "UPPER",
    "textDecoration": "NONE",
    "letterSpacing": {"value": 0.5, "unit": "PIXELS"},
    "lineHeight": {"value": 1.5, "unit": "PERCENT"},
    "paragraphSpacing": 8
  }'
```

**`textAlignHorizontal`:** `LEFT` | `CENTER` | `RIGHT` | `JUSTIFIED`

**`textAlignVertical`:** `TOP` | `CENTER` | `BOTTOM`

**`textAutoResize`:** `NONE` | `WIDTH_AND_HEIGHT` | `HEIGHT` | `TRUNCATE`

**`textCase`:** `ORIGINAL` | `UPPER` | `LOWER` | `TITLE` | `SMALL_CAPS`

**`textDecoration`:** `NONE` | `UNDERLINE` | `STRIKETHROUGH`

**`letterSpacing` / `lineHeight`:** `{ value: number, unit: "PIXELS" | "PERCENT" }` or `{ unit: "AUTO" }` for lineHeight

---

### Shapes

```bash
# Create a frame
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"create-frame","name":"Card","x":0,"y":0,"width":320,"height":240,"parentId":"<id>"}'

# Create a rectangle
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"create-rectangle","name":"Rect","x":0,"y":0,"width":100,"height":100,"parentId":"<id>"}'

# Create an ellipse / circle
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"create-ellipse","name":"Circle","x":0,"y":0,"width":80,"height":80,"parentId":"<id>"}'
```

---

### Style

```bash
# Set fill color — IMPORTANT: use 0-1 float values, NOT 0-255
# red = {"r":1,"g":0,"b":0}, semi-transparent = {"r":0,"g":0.5,"b":1,"a":0.8}
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-fill","nodeId":"<id>","color":{"r":0.2,"g":0.4,"b":1}}'

# Remove all fills
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"clear-fills","nodeId":"<id>"}'

# Set stroke color
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-stroke","nodeId":"<id>","color":{"r":0,"g":0,"b":0}}'

# Set stroke weight and alignment
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-stroke-weight","nodeId":"<id>","weight":2,"align":"INSIDE"}'

# Set opacity (0 to 1)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-opacity","nodeId":"<id>","opacity":0.5}'

# Set corner radius — uniform
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-corner-radius","nodeId":"<id>","radius":8}'

# Set corner radius — per corner
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-corner-radius","nodeId":"<id>","topLeft":8,"topRight":8,"bottomLeft":0,"bottomRight":0}'

# Set blend mode
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-blend-mode","nodeId":"<id>","blendMode":"MULTIPLY"}'

# Set effects (drop shadow example)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{
    "type": "set-effect",
    "nodeId": "<id>",
    "effects": [{
      "type": "DROP_SHADOW",
      "color": {"r":0,"g":0,"b":0,"a":0.15},
      "offset": {"x":0,"y":4},
      "radius": 12,
      "spread": 0,
      "visible": true,
      "blendMode": "NORMAL"
    }]
  }'
```

**`strokeAlign`:** `INSIDE` | `OUTSIDE` | `CENTER`

**`blendMode`:** `NORMAL` | `MULTIPLY` | `SCREEN` | `OVERLAY` | `DARKEN` | `LIGHTEN` | `COLOR_DODGE` | `COLOR_BURN` | `HARD_LIGHT` | `SOFT_LIGHT` | `DIFFERENCE` | `EXCLUSION` | `HUE` | `SATURATION` | `COLOR` | `LUMINOSITY`

**Effect types:** `DROP_SHADOW` | `INNER_SHADOW` | `LAYER_BLUR` | `BACKGROUND_BLUR`

---

### Layout

```bash
# Apply auto layout to a frame (always do this after create-frame)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{
    "type": "set-layout",
    "nodeId": "<id>",
    "layoutMode": "VERTICAL",
    "primaryAxisAlignItems": "MIN",
    "counterAxisAlignItems": "MIN",
    "itemSpacing": 16,
    "paddingTop": 24, "paddingBottom": 24,
    "paddingLeft": 24, "paddingRight": 24,
    "layoutSizingHorizontal": "FILL",
    "layoutSizingVertical": "HUG"
  }'

# Move node (manual positioning — prefer auto layout instead)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"move-node","nodeId":"<id>","x":200,"y":300}'

# Resize node
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"resize-node","nodeId":"<id>","width":400,"height":200}'

# Set rotation (degrees)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-rotation","nodeId":"<id>","rotation":45}'

# Set constraints (for nodes inside non-auto-layout frames)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-constraints","nodeId":"<id>","horizontal":"STRETCH","vertical":"TOP"}'
```

**`layoutMode`:** `NONE` | `HORIZONTAL` | `VERTICAL`

**`primaryAxisAlignItems`:** `MIN` | `MAX` | `CENTER` | `SPACE_BETWEEN`

**`counterAxisAlignItems`:** `MIN` | `MAX` | `CENTER` | `BASELINE`

**`layoutSizingHorizontal` / `layoutSizingVertical`:** `FIXED` | `HUG` | `FILL`

**`layoutAlign` (child property):** `MIN` | `MAX` | `CENTER` | `STRETCH` | `INHERIT`

**`layoutPositioning` (child property):** `AUTO` | `ABSOLUTE`

**Constraints `horizontal`:** `LEFT` | `RIGHT` | `CENTER` | `SCALE` | `STRETCH`

**Constraints `vertical`:** `TOP` | `BOTTOM` | `CENTER` | `SCALE` | `STRETCH`

---

### Node management

```bash
# Rename node
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"rename-node","nodeId":"<id>","name":"New Name"}'

# Show or hide a node
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-visible","nodeId":"<id>","visible":false}'

# Clone / duplicate a node (parentId optional, defaults to same parent)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"clone-node","nodeId":"<id>","x":0,"y":0,"parentId":"<parent-id>"}'

# Move a node into a parent at a specific index
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"insert-child","parentId":"<parent-id>","nodeId":"<id>","index":0}'

# Group multiple nodes
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"group-nodes","nodeIds":["<id1>","<id2>"],"name":"Group"}'

# Select and zoom to a node in Figma
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"select-node","nodeId":"<id>"}'

# Delete a node
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"delete-node","nodeId":"<id>"}'

# Export a node as image (base64-encoded)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"export-node","nodeId":"<id>","format":"PNG","scale":2}'
```

**`export-node` format:** `PNG` | `JPG` | `SVG` | `SVG_STRING`

---

## Design principles

### Always prefer auto layout

When creating or structuring frames, **always apply auto layout** (`set-layout`) immediately after creating a frame. Manual x/y positioning is a last resort — use it only for absolute-positioned overlays or when the user explicitly asks for fixed placement.

**Default pattern for any new frame:**
1. `create-frame` — create the frame
2. `set-layout` with `layoutMode: "VERTICAL"` or `"HORIZONTAL"` — enable auto layout
3. Set sizing: prefer `layoutSizingHorizontal: "FILL"` / `layoutSizingVertical: "HUG"` unless fixed dimensions are needed
4. Set spacing: `itemSpacing` for gap between children, `paddingTop/Bottom/Left/Right` for internal padding

**Auto layout sizing cheatsheet:**

| Goal | layoutSizingHorizontal | layoutSizingVertical |
|------|------------------------|----------------------|
| Grow to fill parent | `FILL` | `FILL` |
| Shrink-wrap children | `HUG` | `HUG` |
| Fixed size | `FIXED` | `FIXED` |

**Children inside an auto layout frame** should use `layoutAlign: "STRETCH"` to fill the cross-axis, or `layoutAlign: "INHERIT"` to respect parent alignment.

When building multi-column layouts, use nested auto layout frames:
- Outer frame: `HORIZONTAL`, spacing between columns
- Each column: `VERTICAL`, `layoutSizingHorizontal: FILL`, spacing between rows

Use `layoutPositioning: "ABSOLUTE"` on a child to make it float above the layout flow (like CSS `position: absolute` inside a flex container).

---

## Workflow guidelines

1. **Always check connection first.** If disconnected, tell the user to start the bridge and enable the Figma plugin before proceeding.

2. **Discover before editing.** When the user references "the button" or "that frame" without a nodeId, call `/page` or `/selection` first to find the correct node ID.

3. **Colors are 0–1 floats.** Convert hex or 0–255 values before sending. `#3366FF` → `{"r":0.2,"g":0.4,"b":1}`.

4. **Confirm destructive actions.** Ask before calling `delete-node` or `group-nodes` that restructures the layer tree.

5. **Use `select-node` for feedback.** After editing a node, optionally call `select-node` so the user can see the result highlighted in Figma.

6. **Always apply auto layout after creating frames.** See Design principles above.

7. **Parse responses.** All responses are JSON. Check the `result` field on success; `error` field on failure.

---

## Example task: "Create a card with a title and description"

```bash
# 1. Check connection
curl -s http://localhost:3056/status

# 2. Create the card frame
CARD=$(curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"create-frame","name":"Card","width":320,"height":100}')
CARD_ID=$(echo $CARD | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['id'])")

# 3. Apply auto layout
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"set-layout\",\"nodeId\":\"$CARD_ID\",\"layoutMode\":\"VERTICAL\",\"itemSpacing\":8,\"paddingTop\":24,\"paddingBottom\":24,\"paddingLeft\":24,\"paddingRight\":24,\"layoutSizingVertical\":\"HUG\"}"

# 4. Add title text
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"create-text\",\"characters\":\"Card Title\",\"fontSize\":18,\"parentId\":\"$CARD_ID\"}"

# 5. Add description text
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"create-text\",\"characters\":\"This is the description.\",\"fontSize\":14,\"parentId\":\"$CARD_ID\"}"

# 6. Select to confirm visually
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"select-node\",\"nodeId\":\"$CARD_ID\"}"
```
