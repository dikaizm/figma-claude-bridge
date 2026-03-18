# Claude Code ↔ Figma Bridge

Connects Claude Code (CLI) to a Figma plugin so Claude can read and edit Figma files.

```
Claude Code  ──HTTP──►  Bridge Server  ──WebSocket──►  Figma Plugin  ──Plugin API──►  Figma File
```

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

## Usage from Claude Code

Claude Code interacts via `curl` through the Bash tool.

### Check connection
```bash
curl http://localhost:3056/status
```

### Get current page
```bash
curl http://localhost:3056/page
```

### Get selected nodes
```bash
curl http://localhost:3056/selection
```

### Send a command
```bash
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{ "type": "COMMAND_TYPE", ...params }'
```

---

## Command Reference

| type | params | description |
|------|--------|-------------|
| `get-selection` | — | Get currently selected nodes |
| `get-node` | `nodeId` | Get a node by ID |
| `get-page-info` | — | Get current page + top-level nodes |
| `list-nodes` | `parentId?` | List children of a node (or page) |
| `set-text` | `nodeId`, `value` | Set text content |
| `create-text` | `characters`, `x?`, `y?`, `fontSize?`, `parentId?` | Create a text node |
| `create-frame` | `name?`, `x?`, `y?`, `width?`, `height?`, `parentId?` | Create a frame |
| `create-rectangle` | `name?`, `x?`, `y?`, `width?`, `height?`, `parentId?` | Create a rectangle |
| `set-fill` | `nodeId`, `color: {r,g,b,a?}` | Set fill (values 0–1) |
| `set-opacity` | `nodeId`, `opacity` | Set opacity (0–1) |
| `move-node` | `nodeId`, `x`, `y` | Move a node |
| `resize-node` | `nodeId`, `width`, `height` | Resize a node |
| `rename-node` | `nodeId`, `name` | Rename a node |
| `select-node` | `nodeId` | Select + zoom to a node |
| `delete-node` | `nodeId` | Delete a node |

### Color format
Colors use 0–1 float values (not 0–255):
```json
{ "r": 1, "g": 0, "b": 0 }        → red
{ "r": 0, "g": 0.47, "b": 1 }     → #0078FF
{ "r": 0.1, "g": 0.1, "b": 0.1 }  → #1a1a1a
```

### Examples
```bash
# Set text on a node
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-text","nodeId":"424:2855","value":"Hello from Claude"}'

# Create a blue frame
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"create-frame","name":"Hero","x":0,"y":0,"width":1440,"height":900}'

# Change fill to brand black
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-fill","nodeId":"424:2855","color":{"r":0.1,"g":0.1,"b":0.1}}'

# Select and zoom to a node
curl -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"select-node","nodeId":"424:2855"}'
```
