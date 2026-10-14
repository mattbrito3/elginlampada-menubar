import 'dotenv/config'
import { z } from 'zod'
import { tuyaApi } from 'tuya-cloud-api'

const environment = z.object({
  TUYA_CLIENT_ID: z.string().min(1),
  TUYA_CLIENT_SECRET: z.string().min(1),
  TUYA_DEVICE_ID: z.string().min(1)
}).parse(process.env)

async function main(): Promise<void> {
  await tuyaApi.authorize({
    apiClientId: environment.TUYA_CLIENT_ID,
    apiClientSecret: environment.TUYA_CLIENT_SECRET,
    serverLocation: 'us'
  })

  await tuyaApi.sendCommand({
    deviceId: environment.TUYA_DEVICE_ID,
    commands: [{ code: 'work_mode', value: 'white' }]
  })
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await tuyaApi.sendCommand({
    deviceId: environment.TUYA_DEVICE_ID,
    commands: [{ code: 'temp_value_v2', value: 590 }]
  })

  const status = await tuyaApi.getDeviceStatus({ deviceId: environment.TUYA_DEVICE_ID })
  const mode = status.find((item) => item.code === 'work_mode')?.value
  const temperature = status.find((item) => item.code === 'temp_value_v2')?.value
  console.log(`Estado restaurado: modo=${String(mode)}, temperatura=${String(temperature)}.`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido'
  console.error(`Falha ao restaurar estado: ${message.replace(/(secret|token|sign)[=:][^\s,}]+/gi, '$1=xxxxxxxx')}`)
  process.exitCode = 1
})
