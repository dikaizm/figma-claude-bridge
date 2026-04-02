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

      case 'set-layout': {
        var layoutNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!layoutNode) throw new Error('Node "' + msg.nodeId + '" not found')
        if (msg.layoutMode !== undefined) layoutNode.layoutMode = msg.layoutMode
        if (msg.paddingLeft !== undefined) layoutNode.paddingLeft = msg.paddingLeft
        if (msg.paddingRight !== undefined) layoutNode.paddingRight = msg.paddingRight
        if (msg.paddingTop !== undefined) layoutNode.paddingTop = msg.paddingTop
        if (msg.paddingBottom !== undefined) layoutNode.paddingBottom = msg.paddingBottom
        if (msg.itemSpacing !== undefined) layoutNode.itemSpacing = msg.itemSpacing
        if (msg.primaryAxisAlignItems !== undefined) layoutNode.primaryAxisAlignItems = msg.primaryAxisAlignItems
        if (msg.counterAxisAlignItems !== undefined) layoutNode.counterAxisAlignItems = msg.counterAxisAlignItems
        if (msg.layoutSizingHorizontal !== undefined) layoutNode.layoutSizingHorizontal = msg.layoutSizingHorizontal
        if (msg.layoutSizingVertical !== undefined) layoutNode.layoutSizingVertical = msg.layoutSizingVertical
        if (msg.layoutAlign !== undefined) layoutNode.layoutAlign = msg.layoutAlign
        if (msg.layoutGrow !== undefined) layoutNode.layoutGrow = msg.layoutGrow
        result = { nodeId: layoutNode.id }
        break
      }

      case 'set-font': {
        var fontNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!fontNode || fontNode.type !== 'TEXT') throw new Error('Text node "' + msg.nodeId + '" not found')
        var fontName = { family: msg.family || 'Inter', style: msg.style || 'Regular' }
        await figma.loadFontAsync(fontName)
        fontNode.fontName = fontName
        if (msg.fontSize !== undefined) fontNode.fontSize = msg.fontSize
        result = { nodeId: fontNode.id }
        break
      }

      case 'apply-text-style-id': {
        var stNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!stNode || stNode.type !== 'TEXT') throw new Error('Text node "' + msg.nodeId + '" not found')
        await figma.loadFontAsync(stNode.fontName === figma.mixed ? { family: 'Inter', style: 'Regular' } : stNode.fontName)
        await stNode.setTextStyleIdAsync(msg.styleId)
        var appliedStyle = await figma.getStyleByIdAsync(msg.styleId)
        result = { nodeId: stNode.id, styleId: msg.styleId, styleName: appliedStyle ? appliedStyle.name : null }
        break
      }

      case 'set-text-style': {
        var tsNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!tsNode || tsNode.type !== 'TEXT') throw new Error('Text node "' + msg.nodeId + '" not found')
        await figma.loadFontAsync(tsNode.fontName === figma.mixed ? { family: 'Inter', style: 'Regular' } : tsNode.fontName)
        if (msg.textAlignHorizontal !== undefined) tsNode.textAlignHorizontal = msg.textAlignHorizontal
        if (msg.textAlignVertical !== undefined) tsNode.textAlignVertical = msg.textAlignVertical
        if (msg.textAutoResize !== undefined) tsNode.textAutoResize = msg.textAutoResize
        if (msg.textCase !== undefined) tsNode.textCase = msg.textCase
        if (msg.textDecoration !== undefined) tsNode.textDecoration = msg.textDecoration
        if (msg.letterSpacing !== undefined) tsNode.letterSpacing = msg.letterSpacing
        if (msg.lineHeight !== undefined) tsNode.lineHeight = msg.lineHeight
        if (msg.paragraphSpacing !== undefined) tsNode.paragraphSpacing = msg.paragraphSpacing
        result = { nodeId: tsNode.id }
        break
      }

      case 'create-ellipse': {
        var ellipse = figma.createEllipse()
        ellipse.name = msg.name || 'Ellipse'
        ellipse.x = msg.x || 0
        ellipse.y = msg.y || 0
        ellipse.resize(msg.width || 100, msg.height || 100)
        await appendToParent(ellipse, msg.parentId)
        result = serializeNode(ellipse)
        break
      }

      case 'clone-node': {
        var srcNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!srcNode) throw new Error('Node "' + msg.nodeId + '" not found')
        var cloned = srcNode.clone()
        if (msg.x !== undefined) cloned.x = msg.x
        if (msg.y !== undefined) cloned.y = msg.y
        await appendToParent(cloned, msg.parentId)
        result = serializeNode(cloned)
        break
      }

      case 'set-corner-radius': {
        var crNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!crNode || !('cornerRadius' in crNode)) throw new Error('Node "' + msg.nodeId + '" does not support corner radius')
        if (msg.topLeft !== undefined || msg.topRight !== undefined || msg.bottomLeft !== undefined || msg.bottomRight !== undefined) {
          crNode.topLeftRadius = msg.topLeft !== undefined ? msg.topLeft : 0
          crNode.topRightRadius = msg.topRight !== undefined ? msg.topRight : 0
          crNode.bottomLeftRadius = msg.bottomLeft !== undefined ? msg.bottomLeft : 0
          crNode.bottomRightRadius = msg.bottomRight !== undefined ? msg.bottomRight : 0
        } else {
          crNode.cornerRadius = msg.radius
        }
        if (msg.cornerSmoothing !== undefined) crNode.cornerSmoothing = msg.cornerSmoothing
        result = { nodeId: crNode.id }
        break
      }

      case 'set-visible': {
        var visNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!visNode) throw new Error('Node "' + msg.nodeId + '" not found')
        visNode.visible = msg.visible
        result = { nodeId: visNode.id, visible: visNode.visible }
        break
      }

      case 'set-blend-mode': {
        var bmNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!bmNode || !('blendMode' in bmNode)) throw new Error('Node "' + msg.nodeId + '" does not support blend mode')
        bmNode.blendMode = msg.blendMode
        result = { nodeId: bmNode.id, blendMode: bmNode.blendMode }
        break
      }

      case 'set-stroke-weight': {
        var swNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!swNode || !('strokeWeight' in swNode)) throw new Error('Node "' + msg.nodeId + '" does not support stroke weight')
        swNode.strokeWeight = msg.weight
        if (msg.align !== undefined) swNode.strokeAlign = msg.align
        result = { nodeId: swNode.id }
        break
      }

      case 'set-effect': {
        var effectNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!effectNode || !('effects' in effectNode)) throw new Error('Node "' + msg.nodeId + '" does not support effects')
        var effects = Array.isArray(msg.effects) ? msg.effects : [msg.effect]
        effectNode.effects = effects
        result = { nodeId: effectNode.id }
        break
      }

      case 'group-nodes': {
        var groupNodes = []
        for (var i = 0; i < msg.nodeIds.length; i++) {
          var gn = await figma.getNodeByIdAsync(msg.nodeIds[i])
          if (gn) groupNodes.push(gn)
        }
        if (groupNodes.length === 0) throw new Error('No valid nodes found to group')
        var groupParent = groupNodes[0].parent
        var group = figma.group(groupNodes, groupParent)
        if (msg.name) group.name = msg.name
        result = serializeNode(group)
        break
      }

      case 'set-constraints': {
        var conNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!conNode || !('constraints' in conNode)) throw new Error('Node "' + msg.nodeId + '" does not support constraints')
        conNode.constraints = {
          horizontal: msg.horizontal || 'LEFT',
          vertical: msg.vertical || 'TOP'
        }
        result = { nodeId: conNode.id, constraints: conNode.constraints }
        break
      }

      case 'set-rotation': {
        var rotNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!rotNode || !('rotation' in rotNode)) throw new Error('Node "' + msg.nodeId + '" does not support rotation')
        rotNode.rotation = msg.rotation
        result = { nodeId: rotNode.id, rotation: rotNode.rotation }
        break
      }

      case 'set-reaction': {
        var reactNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!reactNode) throw new Error('Node "' + msg.nodeId + '" not found')
        if (!('reactions' in reactNode)) throw new Error('Node "' + msg.nodeId + '" does not support reactions')
        var reactions = (msg.reactions || []).map(function(r) {
          // Figma API uses `actions` (array) not `action` (single)
          var actions = r.actions ? r.actions : (r.action ? [r.action] : [])
          return { trigger: r.trigger, actions: actions }
        })
        await reactNode.setReactionsAsync(reactions)
        result = { nodeId: reactNode.id, reactionCount: reactions.length, nodeName: reactNode.name }
        break
      }

      case 'get-styles': {
        var paintStyles = await figma.getLocalPaintStylesAsync()
        var textStyles = await figma.getLocalTextStylesAsync()
        var effectStyles = await figma.getLocalEffectStylesAsync()
        result = {
          paints: paintStyles.map(function(s) { return { id: s.id, name: s.name, key: s.key } }),
          texts: textStyles.map(function(s) { return { id: s.id, name: s.name, key: s.key } }),
          effects: effectStyles.map(function(s) { return { id: s.id, name: s.name, key: s.key } })
        }
        break
      }

      case 'export-node': {
        var expNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!expNode) throw new Error('Node "' + msg.nodeId + '" not found')
        var expSettings = { format: msg.format || 'PNG' }
        if (msg.scale) expSettings.constraint = { type: 'SCALE', value: msg.scale }
        var bytes = await expNode.exportAsync(expSettings)
        result = { nodeId: expNode.id, format: expSettings.format, data: figma.base64Encode(bytes) }
        break
      }

      case 'create-table': {
        var tblRows = msg.rows || 3
        var tblCols = msg.columns || 3
        var tblColWidths = msg.columnWidths || []
        var tblColWidth = msg.columnWidth || 120
        var tblRowH = msg.rowHeight || 40
        var tblHeaderH = msg.headerHeight || tblRowH
        var tblHeaders = msg.headers || []
        var tblData = msg.data || []
        var tblBorderColor = msg.borderColor || { r: 0.878, g: 0.878, b: 0.878 }
        var tblHeaderFill = msg.headerFill || { r: 0.949, g: 0.949, b: 0.949 }
        var tblCellFill = msg.cellFill || null
        var tblFontSize = msg.fontSize || 13
        var tblCellPadH = msg.cellPaddingHorizontal !== undefined ? msg.cellPaddingHorizontal : 12
        var tblCellPadV = msg.cellPaddingVertical !== undefined ? msg.cellPaddingVertical : 0
        var tblFontFamily = msg.fontFamily || 'Inter'

        await figma.loadFontAsync({ family: tblFontFamily, style: 'Regular' })
        await figma.loadFontAsync({ family: tblFontFamily, style: 'Bold' })

        var tblFrame = figma.createFrame()
        tblFrame.name = msg.name || 'Table'
        tblFrame.x = msg.x || 0
        tblFrame.y = msg.y || 0
        tblFrame.layoutMode = 'VERTICAL'
        tblFrame.itemSpacing = 0
        tblFrame.paddingTop = 0
        tblFrame.paddingBottom = 0
        tblFrame.paddingLeft = 0
        tblFrame.paddingRight = 0
        tblFrame.primaryAxisAlignItems = 'MIN'
        tblFrame.counterAxisAlignItems = 'MIN'
        tblFrame.layoutSizingHorizontal = 'HUG'
        tblFrame.layoutSizingVertical = 'HUG'
        tblFrame.clipsContent = true
        tblFrame.fills = []
        tblFrame.strokes = [{ type: 'SOLID', color: { r: tblBorderColor.r, g: tblBorderColor.g, b: tblBorderColor.b }, opacity: tblBorderColor.a !== undefined ? tblBorderColor.a : 1 }]
        tblFrame.strokeWeight = 1
        tblFrame.strokeAlign = 'OUTSIDE'

        var makeTblRow = function(rowName) {
          var row = figma.createFrame()
          row.name = rowName
          row.layoutMode = 'HORIZONTAL'
          row.itemSpacing = 0
          row.paddingTop = 0
          row.paddingBottom = 0
          row.paddingLeft = 0
          row.paddingRight = 0
          row.primaryAxisAlignItems = 'MIN'
          row.counterAxisAlignItems = 'MIN'
          row.layoutSizingHorizontal = 'HUG'
          row.layoutSizingVertical = 'HUG'
          row.fills = []
          return row
        }

        var makeTblCell = function(text, isHeader, width, height) {
          var cell = figma.createFrame()
          cell.resize(width, height)
          cell.layoutMode = 'HORIZONTAL'
          cell.paddingLeft = tblCellPadH
          cell.paddingRight = tblCellPadH
          cell.paddingTop = tblCellPadV
          cell.paddingBottom = tblCellPadV
          cell.primaryAxisAlignItems = 'MIN'
          cell.counterAxisAlignItems = 'CENTER'
          cell.layoutSizingHorizontal = 'FIXED'
          cell.layoutSizingVertical = 'FIXED'
          if (isHeader) {
            cell.fills = [{ type: 'SOLID', color: { r: tblHeaderFill.r, g: tblHeaderFill.g, b: tblHeaderFill.b }, opacity: tblHeaderFill.a !== undefined ? tblHeaderFill.a : 1 }]
          } else if (tblCellFill) {
            cell.fills = [{ type: 'SOLID', color: { r: tblCellFill.r, g: tblCellFill.g, b: tblCellFill.b }, opacity: tblCellFill.a !== undefined ? tblCellFill.a : 1 }]
          } else {
            cell.fills = []
          }
          cell.strokes = [{ type: 'SOLID', color: { r: tblBorderColor.r, g: tblBorderColor.g, b: tblBorderColor.b }, opacity: tblBorderColor.a !== undefined ? tblBorderColor.a : 1 }]
          cell.strokeWeight = 1
          cell.strokeAlign = 'INSIDE'
          var tnode = figma.createText()
          tnode.fontName = { family: tblFontFamily, style: isHeader ? 'Bold' : 'Regular' }
          tnode.characters = text !== undefined && text !== null ? String(text) : ''
          tnode.fontSize = tblFontSize
          tnode.textAutoResize = 'HEIGHT'
          tnode.layoutGrow = 1
          tnode.layoutAlign = 'STRETCH'
          cell.appendChild(tnode)
          return cell
        }

        if (tblHeaders.length > 0) {
          var hRow = makeTblRow('Header')
          for (var hi = 0; hi < tblCols; hi++) {
            var hw = tblColWidths[hi] !== undefined ? tblColWidths[hi] : tblColWidth
            var hCell = makeTblCell(tblHeaders[hi] !== undefined ? tblHeaders[hi] : ('Column ' + (hi + 1)), true, hw, tblHeaderH)
            hCell.name = 'Header ' + (hi + 1)
            hRow.appendChild(hCell)
          }
          tblFrame.appendChild(hRow)
        }

        for (var ri = 0; ri < tblRows; ri++) {
          var dRow = makeTblRow('Row ' + (ri + 1))
          for (var ci = 0; ci < tblCols; ci++) {
            var cw = tblColWidths[ci] !== undefined ? tblColWidths[ci] : tblColWidth
            var cellVal = tblData[ri] && tblData[ri][ci] !== undefined ? tblData[ri][ci] : ''
            var dCell = makeTblCell(cellVal, false, cw, tblRowH)
            dCell.name = 'Cell ' + (ri + 1) + '-' + (ci + 1)
            dRow.appendChild(dCell)
          }
          tblFrame.appendChild(dRow)
        }

        await appendToParent(tblFrame, msg.parentId)
        result = serializeNode(tblFrame)
        break
      }

      case 'create-stagger-set': {
        var ssNode = await figma.getNodeByIdAsync(msg.nodeId)
        if (!ssNode) throw new Error('Node "' + msg.nodeId + '" not found')
        var ssGroups = msg.staggerGroups || []
        var ssDelay = (msg.delay !== undefined ? msg.delay : 150) / 1000
        var ssDuration = msg.duration !== undefined ? msg.duration : 0.3
        var ssNumVariants = ssGroups.length + 1

        function getNodeAtPath(root, path) {
          var cur = root
          for (var pi = 0; pi < path.length; pi++) {
            if (!cur.children || path[pi] >= cur.children.length) return null
            cur = cur.children[path[pi]]
          }
          return cur
        }

        var allPaths = []
        for (var sgi = 0; sgi < ssGroups.length; sgi++) {
          for (var sgni = 0; sgni < ssGroups[sgi].length; sgni++) {
            allPaths.push(ssGroups[sgi][sgni])
          }
        }

        var ssComponents = []

        for (var svi = 0; svi < ssNumVariants; svi++) {
          var ssClone = ssNode.clone()
          ssClone.name = 'State=' + (svi + 1)
          figma.currentPage.appendChild(ssClone)

          for (var sai = 0; sai < allPaths.length; sai++) {
            var tn = getNodeAtPath(ssClone, allPaths[sai])
            if (tn && 'opacity' in tn) tn.opacity = 0
          }

          for (var sri = 0; sri < svi; sri++) {
            for (var srni = 0; srni < ssGroups[sri].length; srni++) {
              var rn = getNodeAtPath(ssClone, ssGroups[sri][srni])
              if (rn && 'opacity' in rn) rn.opacity = 1
            }
          }

          var ssComp = figma.createComponent()
          ssComp.name = ssClone.name
          ssComp.resize(ssClone.width, ssClone.height)
          ssComp.fills = ssClone.fills
          if (ssClone.layoutMode !== undefined && ssClone.layoutMode !== 'NONE') {
            ssComp.layoutMode = ssClone.layoutMode
            ssComp.primaryAxisAlignItems = ssClone.primaryAxisAlignItems
            ssComp.counterAxisAlignItems = ssClone.counterAxisAlignItems
            ssComp.itemSpacing = ssClone.itemSpacing
            ssComp.paddingTop = ssClone.paddingTop
            ssComp.paddingBottom = ssClone.paddingBottom
            ssComp.paddingLeft = ssClone.paddingLeft
            ssComp.paddingRight = ssClone.paddingRight
          }
          var ssCloneKids = []
          for (var scci = 0; scci < ssClone.children.length; scci++) {
            ssCloneKids.push(ssClone.children[scci])
          }
          for (var smci = 0; smci < ssCloneKids.length; smci++) {
            ssComp.appendChild(ssCloneKids[smci])
          }
          ssClone.remove()
          figma.currentPage.appendChild(ssComp)
          ssComponents.push(ssComp)
        }

        var ssSet = figma.combineAsVariants(ssComponents, figma.currentPage)
        if (msg.name) ssSet.name = msg.name
        if (msg.x !== undefined) ssSet.x = msg.x
        if (msg.y !== undefined) ssSet.y = msg.y

        for (var sreaci = 0; sreaci < ssComponents.length - 1; sreaci++) {
          var sfrom = ssComponents[sreaci]
          var sto = ssComponents[sreaci + 1]
          await sfrom.setReactionsAsync([{
            trigger: { type: 'AFTER_TIMEOUT', timeout: ssDelay },
            actions: [{
              type: 'NODE',
              destinationId: sto.id,
              navigation: 'CHANGE_TO',
              transition: {
                type: 'SMART_ANIMATE',
                duration: ssDuration,
                easing: { type: 'EASE_OUT' }
              },
              preserveScrollPosition: false,
              resetVideoPosition: false,
              resetScrollPosition: false,
              resetInteractiveComponents: false
            }]
          }])
        }

        result = serializeNode(ssSet)
        break
      }

      case 'get-variables': {
        var varCollections = await figma.variables.getLocalVariableCollectionsAsync()
        var allVars = await figma.variables.getLocalVariablesAsync()
        result = {
          collections: varCollections.map(function(c) {
            return {
              id: c.id,
              name: c.name,
              modes: c.modes.map(function(m) { return { modeId: m.modeId, name: m.name } }),
              variableIds: c.variableIds
            }
          }),
          variables: allVars.map(function(v) {
            return {
              id: v.id,
              name: v.name,
              resolvedType: v.resolvedType,
              valuesByMode: v.valuesByMode
            }
          })
        }
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
  if ('visible' in node) out.visible = node.visible
  if ('locked' in node) out.locked = node.locked
  if ('fills' in node && node.fills && node.fills.length > 0) out.fills = node.fills
  if ('strokes' in node && node.strokes && node.strokes.length > 0) out.strokes = node.strokes
  if ('strokeWeight' in node && node.strokeWeight !== figma.mixed) out.strokeWeight = node.strokeWeight
  if ('strokeAlign' in node) out.strokeAlign = node.strokeAlign
  if ('effects' in node && node.effects && node.effects.length > 0) out.effects = node.effects
  if ('cornerRadius' in node && node.cornerRadius !== figma.mixed) out.cornerRadius = node.cornerRadius
  if ('blendMode' in node) out.blendMode = node.blendMode
  if ('rotation' in node && node.rotation !== 0) out.rotation = node.rotation
  if ('constraints' in node) out.constraints = node.constraints
  if (node.type === 'TEXT') {
    out.characters = node.characters
    out.fontSize = node.fontSize !== figma.mixed ? node.fontSize : 'mixed'
    out.textAlignHorizontal = node.textAlignHorizontal
    out.textAutoResize = node.textAutoResize
    if (node.fontName !== figma.mixed) out.fontName = node.fontName
    if (node.textStyleId && node.textStyleId !== figma.mixed) {
      out.textStyleId = node.textStyleId
    }
  }
  if ('layoutMode' in node) {
    out.layoutMode = node.layoutMode
    if (node.layoutMode !== 'NONE') {
      out.primaryAxisAlignItems = node.primaryAxisAlignItems
      out.counterAxisAlignItems = node.counterAxisAlignItems
      out.itemSpacing = node.itemSpacing
      out.paddingTop = node.paddingTop
      out.paddingBottom = node.paddingBottom
      out.paddingLeft = node.paddingLeft
      out.paddingRight = node.paddingRight
      out.layoutSizingHorizontal = node.layoutSizingHorizontal
      out.layoutSizingVertical = node.layoutSizingVertical
    }
  }
  if ('layoutAlign' in node) out.layoutAlign = node.layoutAlign
  if ('layoutGrow' in node) out.layoutGrow = node.layoutGrow
  if ('layoutPositioning' in node) out.layoutPositioning = node.layoutPositioning
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
