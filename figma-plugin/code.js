figma.showUI(__html__, { visible: true, width: 260, height: 120, title: 'Claude Code Bridge' })

figma.ui.onmessage = async function(msg) {
  var type = msg.type
  var requestId = msg.requestId

  try {
    var result

    switch (type) {

      case 'get-selection': {
        result = figma.currentPage.selection.map(serializeNode)
        break
      }

      case 'get-node': {
        var node = await figma.getNodeByIdAsync(msg.nodeId)
        if (!node) throw new Error('Node "' + msg.nodeId + '" not found')
        result = serializeNode(node)
        break
      }

      case 'get-page-info': {
        result = {
          id: figma.currentPage.id,
          name: figma.currentPage.name,
          children: figma.currentPage.children.map(function(n) {
            return { id: n.id, name: n.name, type: n.type }
          })
        }
        break
      }

      case 'list-nodes': {
        var listParent = msg.parentId
          ? await figma.getNodeByIdAsync(msg.parentId)
          : figma.currentPage
        if (!listParent || !listParent.children)
          throw new Error('Parent not found or has no children')
        result = listParent.children.map(serializeNode)
        break
      }

      case 'set-text': {
        var textNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!textNode || textNode.type !== 'TEXT')
          throw new Error('Text node "' + msg.nodeId + '" not found')
        await figma.loadFontAsync(textNode.fontName)
        textNode.characters = msg.value
        result = { nodeId: textNode.id, characters: textNode.characters }
        break
      }

      case 'create-text': {
        var newText = figma.createText()
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
        newText.characters = msg.characters || 'New Text'
        newText.x = msg.x || 0
        newText.y = msg.y || 0
        if (msg.fontSize) newText.fontSize = msg.fontSize
        await appendToParent(newText, msg.parentId)
        result = serializeNode(newText)
        break
      }

      case 'create-frame': {
        var frame = figma.createFrame()
        frame.name = msg.name || 'Frame'
        frame.x = msg.x || 0
        frame.y = msg.y || 0
        frame.resize(msg.width || 400, msg.height || 300)
        await appendToParent(frame, msg.parentId)
        result = serializeNode(frame)
        break
      }

      case 'create-rectangle': {
        var rect = figma.createRectangle()
        rect.name = msg.name || 'Rectangle'
        rect.x = msg.x || 0
        rect.y = msg.y || 0
        rect.resize(msg.width || 100, msg.height || 100)
        await appendToParent(rect, msg.parentId)
        result = serializeNode(rect)
        break
      }

      case 'set-fill': {
        var fillNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!fillNode || !('fills' in fillNode))
          throw new Error('Node "' + msg.nodeId + '" not found or has no fills')
        var r = msg.color.r
        var g = msg.color.g
        var b = msg.color.b
        var a = msg.color.a !== undefined ? msg.color.a : 1
        fillNode.fills = [{ type: 'SOLID', color: { r: r, g: g, b: b }, opacity: a }]
        result = { nodeId: fillNode.id }
        break
      }

      case 'clear-fills': {
        var clearNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!clearNode || !('fills' in clearNode))
          throw new Error('Node "' + msg.nodeId + '" not found or has no fills')
        clearNode.fills = []
        result = { nodeId: clearNode.id }
        break
      }

      case 'set-stroke': {
        var strokeNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!strokeNode || !('strokes' in strokeNode))
          throw new Error('Node "' + msg.nodeId + '" not found or has no strokes')
        var sr = msg.color.r
        var sg = msg.color.g
        var sb = msg.color.b
        var sa = msg.color.a !== undefined ? msg.color.a : 1
        strokeNode.strokes = [{ type: 'SOLID', color: { r: sr, g: sg, b: sb }, opacity: sa }]
        result = { nodeId: strokeNode.id }
        break
      }

      case 'set-opacity': {
        var opacityNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!opacityNode) throw new Error('Node "' + msg.nodeId + '" not found')
        opacityNode.opacity = msg.opacity
        result = { nodeId: opacityNode.id, opacity: opacityNode.opacity }
        break
      }

      case 'move-node': {
        var moveNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!moveNode) throw new Error('Node "' + msg.nodeId + '" not found')
        moveNode.x = msg.x
        moveNode.y = msg.y
        result = { nodeId: moveNode.id, x: moveNode.x, y: moveNode.y }
        break
      }

      case 'resize-node': {
        var resizeNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!resizeNode || !('resize' in resizeNode))
          throw new Error('Node "' + msg.nodeId + '" not resizable')
        resizeNode.resize(msg.width, msg.height)
        result = { nodeId: resizeNode.id, width: resizeNode.width, height: resizeNode.height }
        break
      }

      case 'rename-node': {
        var renameNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!renameNode) throw new Error('Node "' + msg.nodeId + '" not found')
        renameNode.name = msg.name
        result = { nodeId: renameNode.id, name: renameNode.name }
        break
      }

      case 'select-node': {
        var selectNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!selectNode) throw new Error('Node "' + msg.nodeId + '" not found')
        figma.currentPage.selection = [selectNode]
        figma.viewport.scrollAndZoomIntoView([selectNode])
        result = { nodeId: selectNode.id }
        break
      }

      case 'delete-node': {
        var deleteNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!deleteNode) throw new Error('Node "' + msg.nodeId + '" not found')
        deleteNode.remove()
        result = { deleted: msg.nodeId }
        break
      }

      case 'insert-child': {
        var insertParent = await figma.getNodeByIdAsync(msg.parentId)
        if (!insertParent || !('insertChild' in insertParent))
          throw new Error('Parent "' + msg.parentId + '" not found or does not support insertChild')
        var insertNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!insertNode) throw new Error('Node "' + msg.nodeId + '" not found')
        insertParent.insertChild(msg.index, insertNode)
        result = { nodeId: insertNode.id, index: msg.index }
        break
      }

      default:
        throw new Error('Unknown command type: "' + type + '"')
    }

    figma.ui.postMessage({ requestId: requestId, result: result })
  } catch (err) {
    figma.ui.postMessage({ requestId: requestId, error: err.message })
  }
}

async function appendToParent(node, parentId) {
  if (parentId) {
    var parent = await figma.getNodeByIdAsync(parentId)
    if (parent && 'appendChild' in parent) {
      parent.appendChild(node)
      return
    }
  }
  figma.currentPage.appendChild(node)
}

function serializeNode(node) {
  var out = {
    id: node.id,
    name: node.name,
    type: node.type
  }
  if ('x' in node) out.x = node.x
  if ('y' in node) out.y = node.y
  if ('width' in node) out.width = node.width
  if ('height' in node) out.height = node.height
  if ('opacity' in node) out.opacity = node.opacity
  if ('fills' in node && node.fills && node.fills.length > 0) out.fills = node.fills
  if ('strokes' in node && node.strokes && node.strokes.length > 0) out.strokes = node.strokes
  if (node.type === 'TEXT') {
    out.characters = node.characters
    out.fontSize = node.fontSize
  }
  if ('layoutMode' in node) out.layoutMode = node.layoutMode
  if ('children' in node) {
    out.childCount = node.children.length
  }
  if ('reactions' in node && node.reactions && node.reactions.length > 0) {
    out.reactions = node.reactions.map(function(r) {
      var reaction = {}
      if (r.trigger) reaction.trigger = r.trigger
      if (r.action) {
        reaction.action = {}
        if (r.action.type) reaction.action.type = r.action.type
        if (r.action.transition) {
          var t = r.action.transition
          reaction.action.transition = {
            type: t.type,
            duration: t.duration,
            easing: t.easing
          }
        }
        if (r.action.destinationId) reaction.action.destinationId = r.action.destinationId
      }
      return reaction
    })
  }
  return out
}
