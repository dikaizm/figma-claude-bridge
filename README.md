# Claude Code ↔ Figma Bridge

Connects Claude Code (CLI) to a Figma plugin so Claude can read and edit Figma files.

```
Claude Code  ──HTTP──►  Bridge Server  ──WebSocket──►  Figma Plugin  ──Plugin API──►  Figma File
```

> The bridge server and Figma plugin are AI-agnostic. Any HTTP client can use the API — not just Claude Code.

---

## Setup

### 1. Start the bridge server
```bash
cd bridge
npm start
```

### 2. Load the plugin in Figma
1. Open Figma Desktop
2. Menu → **Plugins** → **Development** → **Import plugin from manifest…**
3. Select `figma-plugin/manifest.json`
4. Run the plugin: **Plugins** → **Development** → **Claude Code Bridge**

The terminal will print `✅ Figma plugin connected` when the plugin connects.

---

## HTTP API

Base URL: `http://localhost:3056`

### GET /status
Check if the Figma plugin is connected.

```bash
curl http://localhost:3056/status
```

### GET /selection
Get the currently selected nodes.

```bash
curl http://localhost:3056/selection
```

### GET /page
Get the current page and its top-level children.

```bash
curl http://localhost:3056/page
```

### POST /command
Send a command to Figma. Body must be JSON with a `type` field and any required params.

```bash
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{ "type": "COMMAND_TYPE", ...params }'
```

---

## Command Reference

### Read

| type | params | description |
|------|--------|-------------|
| `get-selection` | — | Get currently selected nodes |
| `get-node` | `nodeId` | Get a node by ID |
| `get-page-info` | — | Get current page + top-level nodes |
| `list-nodes` | `parentId?` | List children of a node (or page if omitted) |
| `get-styles` | — | List all local paint, text, and effect styles |
| `export-node` | `nodeId`, `format?` (PNG/JPG/SVG), `scale?` | Export a node as base64-encoded image |

### Create

| type | params | description |
|------|--------|-------------|
| `create-frame` | `name?`, `x?`, `y?`, `width?`, `height?`, `parentId?` | Create a frame |
| `create-rectangle` | `name?`, `x?`, `y?`, `width?`, `height?`, `parentId?` | Create a rectangle |
| `create-ellipse` | `name?`, `x?`, `y?`, `width?`, `height?`, `parentId?` | Create an ellipse |
| `create-text` | `characters?`, `x?`, `y?`, `fontSize?`, `parentId?` | Create a text node |

### Text

| type | params | description |
|------|--------|-------------|
| `set-text` | `nodeId`, `value` | Set text content |
| `set-font` | `nodeId`, `family?`, `style?`, `fontSize?` | Set font family, style, and/or size |
| `set-text-style` | `nodeId`, `textAlignHorizontal?`, `textAlignVertical?`, `textAutoResize?`, `textCase?`, `textDecoration?`, `letterSpacing?`, `lineHeight?`, `paragraphSpacing?` | Set text styling properties |

### Fills & Strokes

| type | params | description |
|------|--------|-------------|
| `set-fill` | `nodeId`, `color: {r,g,b,a?}` | Set solid fill (values 0–1) |
| `clear-fills` | `nodeId` | Remove all fills |
| `set-stroke` | `nodeId`, `color: {r,g,b,a?}` | Set solid stroke color |
| `set-stroke-weight` | `nodeId`, `weight`, `align?` | Set stroke weight and alignment (CENTER/INSIDE/OUTSIDE) |

### Appearance

| type | params | description |
|------|--------|-------------|
| `set-opacity` | `nodeId`, `opacity` | Set opacity (0–1) |
| `set-corner-radius` | `nodeId`, `radius?`, `topLeft?`, `topRight?`, `bottomLeft?`, `bottomRight?`, `cornerSmoothing?` | Set corner radius (uniform or per-corner) |
| `set-blend-mode` | `nodeId`, `blendMode` | Set blend mode (NORMAL, MULTIPLY, SCREEN, etc.) |
| `set-effect` | `nodeId`, `effects` (array) or `effect` (single) | Set drop shadow, inner shadow, or blur effects |
| `set-visible` | `nodeId`, `visible` | Show or hide a node |

### Layout & Position

| type | params | description |
|------|--------|-------------|
| `move-node` | `nodeId`, `x`, `y` | Move a node to absolute position |
| `resize-node` | `nodeId`, `width`, `height` | Resize a node |
| `set-rotation` | `nodeId`, `rotation` | Set rotation in degrees |
| `set-constraints` | `nodeId`, `horizontal?`, `vertical?` | Set resize constraints (LEFT/RIGHT/CENTER/SCALE/STRETCH) |
| `set-layout` | `nodeId`, `layoutMode?`, `paddingLeft?`, `paddingRight?`, `paddingTop?`, `paddingBottom?`, `itemSpacing?`, `primaryAxisAlignItems?`, `counterAxisAlignItems?`, `layoutSizingHorizontal?`, `layoutSizingVertical?`, `layoutAlign?`, `layoutGrow?` | Configure Auto Layout |

### Node Management

| type | params | description |
|------|--------|-------------|
| `rename-node` | `nodeId`, `name` | Rename a node |
| `select-node` | `nodeId` | Select and zoom to a node |
| `delete-node` | `nodeId` | Delete a node |
| `clone-node` | `nodeId`, `x?`, `y?`, `parentId?` | Clone a node |
| `insert-child` | `parentId`, `nodeId`, `index` | Insert a node into a parent at a given index |
| `group-nodes` | `nodeIds` (array), `name?` | Group multiple nodes |

### Prototyping

| type | params | description |
|------|--------|-------------|
| `set-reaction` | `nodeId`, `reactions` (array of `{trigger, actions}`) | Set prototype interactions on a node |

---

## Color Format

Colors use normalized 0–1 float values (not 0–255):

```json
{ "r": 1, "g": 0, "b": 0 }          → red
{ "r": 0, "g": 0.47, "b": 1 }       → #0078FF
{ "r": 0.1, "g": 0.1, "b": 0.1 }    → #1a1a1a
{ "r": 0, "g": 0, "b": 0, "a": 0.5 } → 50% black
```

---

## Examples

```bash
# Set text content
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-text","nodeId":"424:2855","value":"Hello World"}'

# Create a blue frame
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"create-frame","name":"Hero","x":0,"y":0,"width":1440,"height":900}'

# Change fill color
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-fill","nodeId":"424:2855","color":{"r":0.1,"g":0.1,"b":0.1}}'

# Set font
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-font","nodeId":"424:2855","family":"Inter","style":"Bold","fontSize":24}'

# Enable Auto Layout (horizontal, centered)
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-layout","nodeId":"424:2855","layoutMode":"HORIZONTAL","paddingLeft":16,"paddingRight":16,"paddingTop":12,"paddingBottom":12,"itemSpacing":8,"primaryAxisAlignItems":"CENTER","counterAxisAlignItems":"CENTER"}'

# Add drop shadow
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-effect","nodeId":"424:2855","effects":[{"type":"DROP_SHADOW","color":{"r":0,"g":0,"b":0,"a":0.25},"offset":{"x":0,"y":4},"radius":8,"visible":true}]}'

# Select and zoom to a node
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"select-node","nodeId":"424:2855"}'

# Clone a node
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"clone-node","nodeId":"424:2855","x":100,"y":200}'

# Group nodes
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"group-nodes","nodeIds":["424:2855","424:2856"],"name":"My Group"}'

# Export node as PNG (returns base64)
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"export-node","nodeId":"424:2855","format":"PNG","scale":2}'
```
