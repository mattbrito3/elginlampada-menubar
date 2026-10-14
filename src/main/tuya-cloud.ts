import { z } from 'zod'
import { tuyaApi } from 'tuya-cloud-api'

const settingsSchema = z.object({
  TUYA_CLIENT_ID: z.string().min(1),
  TUYA_CLIENT_SECRET: z.string().min(1),
  TUYA_DEVICE_ID: z.string().min(1)
})

const colourSchema = z.object({
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(1000),
  v: z.number().min(0).max(1000)
})

export type LampState = {
  online: boolean
  power: boolean
  mode: 'white' | 'colour' | 'scene' | 'music'
  brightness: number
  temperature: number
  colour: z.infer<typeof colourSchema>
}

export class TuyaLamp {
  private readonly settings = settingsSchema.parse(process.env)
  private authorized = false

  async getState(): Promise<LampState> {
    await this.ensureAuthorized()
    const [device, status] = await Promise.all([
      tuyaApi.getDevice({ deviceId: this.settings.TUYA_DEVICE_ID }),
      tuyaApi.getDeviceStatus({ deviceId: this.settings.TUYA_DEVICE_ID })
    ])
    const values = new Map(status.map((item) => [item.code, item.value]))
    const colour = parseColour(values.get('colour_data_v2'))
    const mode = values.get('work_mode')
    if (!isMode(mode)) throw new Error('A Tuya retornou um modo de operação inválido.')
    return {
      online: device.online,
      power: requireBoolean(values, 'switch_led'),
      mode,
      brightness: requireNumber(values, 'bright_value_v2'),
      temperature: requireNumber(values, 'temp_value_v2'),
      colour
    }
  }

  async setPower(power: boolean): Promise<LampState> {
    await this.send('switch_led', power)
    return this.getState()
  }

  async setBrightness(brightness: number): Promise<LampState> {
    const value = z.number().int().min(10).max(1000).parse(brightness)
    await this.send('bright_value_v2', value)
    return this.getState()
  }

  async setColour(colour: z.infer<typeof colourSchema>): Promise<LampState> {
    const value = colourSchema.parse(colour)
    await this.send('work_mode', 'colour')
    await this.send('colour_data_v2', JSON.stringify(value))
    return this.getState()
  }

  async setTemperature(temperature: number): Promise<LampState> {
    const value = z.number().int().min(0).max(1000).parse(temperature)
    await this.send('work_mode', 'white')
    await this.send('temp_value_v2', value)
    return this.getState()
  }

  private async send(code: string, value: boolean | number | string): Promise<void> {
    await this.ensureAuthorized()
    await tuyaApi.sendCommand({
      deviceId: this.settings.TUYA_DEVICE_ID,
      commands: [{ code, value }]
    })
  }

  private async ensureAuthorized(): Promise<void> {
    if (this.authorized) return
    await tuyaApi.authorize({
      apiClientId: this.settings.TUYA_CLIENT_ID,
      apiClientSecret: this.settings.TUYA_CLIENT_SECRET,
      serverLocation: 'us'
    })
    this.authorized = true
  }
}

function requireBoolean(values: Map<string, unknown>, code: string): boolean {
  const value = values.get(code)
  if (typeof value !== 'boolean') throw new Error(`Status ${code} inválido.`)
  return value
}

function requireNumber(values: Map<string, unknown>, code: string): number {
  const value = values.get(code)
  if (typeof value !== 'number') throw new Error(`Status ${code} inválido.`)
  return value
}

function parseColour(value: unknown): z.infer<typeof colourSchema> {
  if (typeof value !== 'string') throw new Error('A Tuya retornou uma cor inválida.')
  return colourSchema.parse(JSON.parse(value))
}

function isMode(value: unknown): value is LampState['mode'] {
  return value === 'white' || value === 'colour' || value === 'scene' || value === 'music'
}
