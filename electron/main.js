const { app, BrowserWindow } = require('electron')
const path = require('path')
const http = require('http')

// Fix Wayland/GPU compatibility issues on Linux
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('ozone-platform', 'x11')
app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder')
app.commandLine.appendSwitch('disable-gpu')
const PORT = Number(process.env.FLUX_PORT) || 4000

let httpServer = null
let mainWindow = null

async function startServer() {
  const { spawn } = require('child_process')
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'server.js')
    : path.join(__dirname, '..', 'src', 'server.ts')

  const cwd = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..')

  httpServer = spawn('bun', ['run', serverPath], { cwd, stdio: 'pipe' })

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30000
    function attempt() {
      const req = http.get(`http://127.0.0.1:${PORT}`, (res) => {
        res.resume()
        resolve()
      })
      req.setTimeout(1000, () => req.destroy())
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('Server not ready'))
        else setTimeout(attempt, 500)
      })
    }
    attempt()
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'Subscription Monitor',
    backgroundColor: '#0a0f1e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  try {
    await startServer()
    await createWindow()
  } catch (err) {
    console.error('Startup error:', err)
    app.quit()
  }

  app.on('activate', async () => {
    if (!mainWindow) await createWindow()
  })
})

app.on('window-all-closed', () => {
  if (httpServer) httpServer.kill()
  if (process.platform !== 'darwin') app.quit()
})
