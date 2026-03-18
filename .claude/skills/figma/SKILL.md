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

### Read operations

```bash
# Get current page info and top-level children
curl -s http://localhost:3056/page

# Get selected nodes
curl -s http://localhost:3056/selection

# Get a node by ID
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"get-node","nodeId":"<id>"}'

# List children of a node (omit parentId for current page)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"list-nodes","parentId":"<id>"}'
```

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
```

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
```

### Style

```bash
# Set fill color — IMPORTANT: use 0-1 float values, NOT 0-255
# Example: red = {"r":1,"g":0,"b":0}, semi-transparent = {"r":0,"g":0.5,"b":1,"a":0.8}
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-fill","nodeId":"<id>","color":{"r":0.2,"g":0.4,"b":1}}'

# Set opacity (0 to 1)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-opacity","nodeId":"<id>","opacity":0.5}'
```

### Layout

```bash
# Move node
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"move-node","nodeId":"<id>","x":200,"y":300}'

# Resize node
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"resize-node","nodeId":"<id>","width":400,"height":200}'
```

### Node management

```bash
# Rename node
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"rename-node","nodeId":"<id>","name":"New Name"}'

# Select and zoom to a node in Figma
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"select-node","nodeId":"<id>"}'

# Delete a node
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"delete-node","nodeId":"<id>"}'
```

## Workflow guidelines

1. **Always check connection first.** If disconnected, tell the user to start the bridge and enable the Figma plugin before proceeding.

2. **Discover before editing.** When the user references "the button" or "that frame" without a nodeId, call `/page` or `/selection` first to find the correct node ID.

3. **Colors are 0–1 floats.** Convert hex or 0–255 values before sending. `#3366FF` → `{"r":0.2,"g":0.4,"b":1}`.

4. **Confirm destructive actions.** Ask before calling `delete-node`.

5. **Use `select-node` for feedback.** After editing a node, optionally call `select-node` so the user can see the result highlighted in Figma.

6. **Parse responses.** Responses are JSON. Node objects include `id`, `name`, `type`, `x`, `y`, `width`, `height`, `opacity`, `characters` (for text), and `children` (for frames).

## Example task: "Change the hero title to 'Welcome'"

```bash
# 1. Check connection
curl -s http://localhost:3056/status

# 2. Get page to find the text node
curl -s http://localhost:3056/page

# 3. Set the text (using the id found above)
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set-text","nodeId":"123:45","value":"Welcome"}'

# 4. Select to confirm visually
curl -s -X POST http://localhost:3056/command \
  -H "Content-Type: application/json" \
  -d '{"type":"select-node","nodeId":"123:45"}'
```
