import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { config } from 'dotenv'
import { z } from 'zod'
import { TuyaLamp } from './tuya-cloud'

config({ path: join(app.getPath('userData'), '.env') })
config()

const settingsSchema = z.object({
  TUYA_ENDPOINT: z.string().url(),
  TUYA_CLIENT_ID: z.string().min(1),
  TUYA_CLIENT_SECRET: z.string().min(1),
  TUYA_DEVICE_ID: z.string().min(1)
})

let tray: Tray | undefined
let panel: BrowserWindow | undefined
const lamp = new TuyaLamp()
const favoriteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  mode: z.enum(['white', 'colour', 'scene', 'music']),
  brightness: z.number().int().min(10).max(1000),
  temperature: z.number().int().min(0).max(1000),
  colour: z.object({
    h: z.number().min(0).max(360),
    s: z.number().min(0).max(1000),
    v: z.number().min(0).max(1000)
  })
})
const favoritesSchema = z.array(favoriteSchema).max(20)
type Favorite = z.infer<typeof favoriteSchema>

function favoritesPath(): string {
  return join(app.getPath('userData'), 'favorites.json')
}

async function readFavorites(): Promise<Favorite[]> {
  try {
    return favoritesSchema.parse(JSON.parse(await readFile(favoritesPath(), 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw new Error('Não foi possível ler os favoritos locais.')
  }
}

async function writeFavorites(favorites: Favorite[]): Promise<Favorite[]> {
  const validated = favoritesSchema.parse(favorites)
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(favoritesPath(), JSON.stringify(validated, null, 2), 'utf8')
  return validated
}

function hasTuyaConfiguration(): boolean {
  return settingsSchema.safeParse(process.env).success
}

function createPanel(): BrowserWindow {
  const window = new BrowserWindow({
    width: 390,
    height: 720,
    frame: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.on('blur', () => window.hide())
  window.on('closed', () => {
    panel = undefined
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

function showPanel(): void {
  if (!panel || panel.isDestroyed()) {
    panel = createPanel()
  }

  const trayBounds = tray?.getBounds()
  const display = screen.getDisplayNearestPoint({
    x: trayBounds?.x ?? 0,
    y: trayBounds?.y ?? 0
  })
  const workArea = display.workArea
  const bounds = panel.getBounds()
  const x = Math.max(workArea.x, Math.min(
    (trayBounds?.x ?? workArea.x) - bounds.width + (trayBounds?.width ?? 0),
    workArea.x + workArea.width - bounds.width
  ))
  const y = Math.max(workArea.y, Math.min(
    (trayBounds?.y ?? workArea.y) - bounds.height,
    workArea.y + workArea.height - bounds.height
  ))

  panel.setPosition(x, y)
  panel.show()
  panel.focus()
}

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/tray.png')
  const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Lâmpada Elgin')
  tray.on('click', () => {
    if (panel?.isVisible()) panel.hide()
    else showPanel()
  })
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir painel', click: showPanel },
    { label: 'Ligar/Desligar', click: () => panel?.webContents.send('lamp:toggle') },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ]))
}

function registerIpc(): void {
  ipcMain.handle('tuya:configuration-status', () => ({
    configured: hasTuyaConfiguration()
  }))
  ipcMain.handle('lamp:get-state', () => lamp.getState())
  ipcMain.handle('lamp:set-power', (_event, power: unknown) =>
    lamp.setPower(z.boolean().parse(power)))
  ipcMain.handle('lamp:set-brightness', (_event, brightness: unknown) =>
    lamp.setBrightness(z.number().parse(brightness)))
  ipcMain.handle('lamp:set-colour', (_event, colour: unknown) =>
    lamp.setColour(z.object({
      h: z.number(),
      s: z.number(),
      v: z.number()
    }).parse(colour)))
  ipcMain.handle('lamp:set-temperature', (_event, temperature: unknown) =>
    lamp.setTemperature(z.number().parse(temperature)))
  ipcMain.handle('favorites:list', () => readFavorites())
  ipcMain.handle('favorites:save', async (_event, favorite: unknown) => {
    const value = favoriteSchema.parse(favorite)
    const favorites = (await readFavorites()).filter((item) => item.id !== value.id)
    return writeFavorites([value, ...favorites].slice(0, 20))
  })
  ipcMain.handle('favorites:delete', async (_event, id: unknown) => {
    const value = z.string().min(1).parse(id)
    return writeFavorites((await readFavorites()).filter((item) => item.id !== value))
  })
}

const lock = app.requestSingleInstanceLock()
if (!lock) {
  app.quit()
} else {
  app.on('second-instance', () => showPanel())
  app.whenReady().then(() => {
    registerIpc()
    createTray()
    showPanel()
  })
}
