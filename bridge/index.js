const express = require('express')
const { WebSocketServer } = require('ws')
const { randomUUID } = require('crypto')

const HTTP_PORT = 3056
const WS_PORT = 3055

const app = express()
app.use(express.json())

let figmaSocket = null
const pending = new Map()

function log(direction, label, data) {
  const ts = new Date().toISOString().split('T')[1].slice(0, 12)
  const dataStr = data ? ' ' + JSON.stringify(data) : ''
  console.log(`[${ts}] ${direction} ${label}${dataStr}`)
}

// ─── WebSocket server (Figma plugin connects here) ────────────────────────────

const wss = new WebSocketServer({ port: WS_PORT })

wss.on('connection', (ws) => {
  figmaSocket = ws
  log('✅', 'Figma plugin connected')

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      log('◀', 'Figma →', msg.error ? { requestId: msg.requestId, error: msg.error } : { requestId: msg.requestId, result: msg.result })

      const req = pending.get(msg.requestId)
      if (!req) {
        log('⚠', 'No pending request for requestId', { requestId: msg.requestId })
        return
      }
      clearTimeout(req.timeout)
      pending.delete(msg.requestId)
      if (msg.error) req.reject(new Error(msg.error))
      else req.resolve(msg.result)
    } catch (e) {
      log('❌', 'Bad message from Figma:', { raw: data.toString(), error: e.message })
    }
  })

  ws.on('close', () => {
    figmaSocket = null
    log('❌', 'Figma plugin disconnected')
  })

  ws.on('error', (err) => {
    log('❌', 'WebSocket error', { error: err.message })
  })
})

// ─── Send command to Figma and wait for response ──────────────────────────────

function send(command) {
  return new Promise((resolve, reject) => {
    if (!figmaSocket || figmaSocket.readyState !== 1) {
      return reject(new Error('Figma plugin not connected. Open the plugin in Figma first.'))
    }
    const requestId = randomUUID()
    const payload = Object.assign({}, command, { requestId })

    log('▶', '→ Figma', payload)

    const timeout = setTimeout(() => {
      pending.delete(requestId)
      log('⏱', 'Timeout waiting for Figma response', { requestId })
      reject(new Error('Timeout: Figma did not respond within 10s'))
    }, 10000)

    pending.set(requestId, { resolve, reject, timeout })
    figmaSocket.send(JSON.stringify(payload))
  })
}

// ─── HTTP endpoints ───────────────────────────────────────────────────────────

app.get('/status', (_req, res) => {
  const connected = figmaSocket?.readyState === 1
  log('🔍', 'GET /status', { connected })
  res.json({ connected })
})

app.post('/command', async (req, res) => {
  log('📥', 'POST /command', req.body)
  try {
    const result = await send(req.body)
    log('📤', 'POST /command response', { result })
    res.json({ ok: true, result })
  } catch (err) {
    log('❌', 'POST /command error', { error: err.message })
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.get('/selection', async (_req, res) => {
  log('📥', 'GET /selection')
  try {
    const result = await send({ type: 'get-selection' })
    log('📤', 'GET /selection response', { count: result.length })
    res.json({ ok: true, result })
  } catch (err) {
    log('❌', 'GET /selection error', { error: err.message })
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.get('/page', async (_req, res) => {
  log('📥', 'GET /page')
  try {
    const result = await send({ type: 'get-page-info' })
    log('📤', 'GET /page response', { name: result.name, children: result.children.length })
    res.json({ ok: true, result })
  } catch (err) {
    log('❌', 'GET /page error', { error: err.message })
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(HTTP_PORT, () => {
  console.log('')
  console.log('🌉 Claude Code ↔ Figma Bridge')
  console.log('─────────────────────────────────────────')
  console.log(`HTTP  → http://localhost:${HTTP_PORT}`)
  console.log(`WS    → ws://localhost:${WS_PORT}  (Figma plugin)`)
  console.log('')
  console.log('Endpoints:')
  console.log('  GET  /status     check if Figma plugin is connected')
  console.log('  GET  /selection  get currently selected nodes')
  console.log('  GET  /page       get current page info + top-level nodes')
  console.log('  POST /command    send any command (see README)')
  console.log('')
  console.log('Waiting for Figma plugin to connect...')
  console.log('')
})
