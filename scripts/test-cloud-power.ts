import 'dotenv/config'
import { z } from 'zod'
import { tuyaApi } from 'tuya-cloud-api'

const environmentSchema = z.object({
  TUYA_CLIENT_ID: z.string().min(1),
  TUYA_CLIENT_SECRET: z.string().min(1),
  TUYA_DEVICE_ID: z.string().min(1)
})

const environment = environmentSchema.parse({
  TUYA_CLIENT_ID: process.env.TUYA_CLIENT_ID,
  TUYA_CLIENT_SECRET: process.env.TUYA_CLIENT_SECRET,
  TUYA_DEVICE_ID: process.env.TUYA_DEVICE_ID
})

async function main(): Promise<void> {
  await tuyaApi.authorize({
    apiClientId: environment.TUYA_CLIENT_ID,
    apiClientSecret: environment.TUYA_CLIENT_SECRET,
    serverLocation: 'us'
  })

  const before = await readPower()
  if (before !== true) {
    throw new Error(`Estado inicial inesperado: switch_led=${String(before)}; nenhum comando enviado.`)
  }

  console.log('Estado inicial confirmado: ligada.')
  console.log('Enviando comando Cloud: desligar...')
  await tuyaApi.sendCommand({
    deviceId: environment.TUYA_DEVICE_ID,
    commands: [{ code: 'switch_led', value: false }]
  })

  const afterOff = await readPower()
  console.log(`Estado após desligar: ${String(afterOff)}.`)

  console.log('Restaurando estado original: ligar...')
  await tuyaApi.sendCommand({
    deviceId: environment.TUYA_DEVICE_ID,
    commands: [{ code: 'switch_led', value: true }]
  })

  const afterRestore = await readPower()
  console.log(`Estado após restaurar: ${String(afterRestore)}.`)
  if (afterOff !== false || afterRestore !== true) {
    throw new Error('A Tuya Cloud não confirmou uma ou mais transições de energia.')
  }
  console.log('Teste Cloud de energia concluído; lâmpada restaurada como ligada.')
}

async function readPower(): Promise<boolean> {
  const status = await tuyaApi.getDeviceStatus({ deviceId: environment.TUYA_DEVICE_ID })
  const power = status.find((item) => item.code === 'switch_led')?.value
  if (typeof power !== 'boolean') {
    throw new Error('A resposta Cloud não contém switch_led booleano.')
  }
  return power
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido'
  console.error(`Falha no teste Cloud: ${sanitizeError(message)}`)
  process.exitCode = 1
})

function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer xxxxxxxx')
    .replace(/(secret|token|sign|client_secret|access_token)[=:][^\s,}]+/gi, '$1=xxxxxxxx')
}
