import 'dotenv/config'
import { z } from 'zod'
import { tuyaApi } from 'tuya-cloud-api'

const environment = z.object({
  TUYA_CLIENT_ID: z.string().min(1),
  TUYA_CLIENT_SECRET: z.string().min(1),
  TUYA_DEVICE_ID: z.string().min(1)
}).parse(process.env)

type StatusValue = boolean | number | string

async function main(): Promise<void> {
  await tuyaApi.authorize({
    apiClientId: environment.TUYA_CLIENT_ID,
    apiClientSecret: environment.TUYA_CLIENT_SECRET,
    serverLocation: 'us'
  })

  const initial = await readStatus()
  const brightness = numberStatus(initial, 'bright_value_v2')
  const temperature = numberStatus(initial, 'temp_value_v2')
  const colour = jsonStatus(initial, 'colour_data_v2')

  console.log(`Estado inicial: brilho=${brightness}, temperatura=${temperature}.`)
  console.log('Testando brilho em 500...')
  await send('bright_value_v2', 500)
  console.log(`Brilho confirmado: ${numberStatus(await readStatus(), 'bright_value_v2')}.`)

  console.log('Testando cor HSV (h=120, s=1000, v=1000)...')
  await send('work_mode', 'colour')
  await send('colour_data_v2', JSON.stringify({ h: 120, s: 1000, v: 1000 }))
  const colourAfter = jsonStatus(await readStatus(), 'colour_data_v2')
  console.log(`Cor confirmada: ${JSON.stringify(colourAfter)}.`)

  console.log('Testando temperatura em 300...')
  await send('work_mode', 'white')
  await send('temp_value_v2', 300)
  console.log(`Temperatura confirmada: ${numberStatus(await readStatus(), 'temp_value_v2')}.`)

  console.log('Restaurando valores originais...')
  await send('bright_value_v2', brightness)
  await send('work_mode', 'white')
  await send('temp_value_v2', temperature)
  await send('colour_data_v2', JSON.stringify(colour))
  console.log('Valores restaurados. A lâmpada permanece ligada.')
}

async function readStatus(): Promise<Map<string, StatusValue>> {
  const status = await tuyaApi.getDeviceStatus({ deviceId: environment.TUYA_DEVICE_ID })
  return new Map(status.map((item) => [item.code, item.value as StatusValue]))
}

async function send(code: string, value: StatusValue | object): Promise<void> {
  await tuyaApi.sendCommand({
    deviceId: environment.TUYA_DEVICE_ID,
    commands: [{ code, value }]
  })
}

function numberStatus(status: Map<string, StatusValue>, code: string): number {
  const value = status.get(code)
  if (typeof value !== 'number') throw new Error(`Status ${code} não é numérico.`)
  return value
}

function jsonStatus(status: Map<string, StatusValue>, code: string): Record<string, number> {
  const value = status.get(code)
  if (typeof value !== 'string') throw new Error(`Status ${code} não é JSON.`)
  const parsed: unknown = JSON.parse(value)
  if (!isNumberRecord(parsed)) throw new Error(`Status ${code} tem formato inesperado.`)
  return parsed
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return typeof value === 'object' && value !== null &&
    Object.values(value).every((item) => typeof item === 'number')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido'
  console.error(`Falha no teste Cloud de luz: ${sanitizeError(message)}`)
  process.exitCode = 1
})

function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer xxxxxxxx')
    .replace(/(secret|token|sign|client_secret|access_token)[=:][^\s,}]+/gi, '$1=xxxxxxxx')
}
