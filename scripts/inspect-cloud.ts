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
  console.log('Autenticando na Tuya Cloud (região us)...')
  await tuyaApi.authorize({
    apiClientId: environment.TUYA_CLIENT_ID,
    apiClientSecret: environment.TUYA_CLIENT_SECRET,
    serverLocation: 'us'
  })

  console.log('Consultando dispositivo...')
  const [device, functions, status] = await Promise.all([
    tuyaApi.getDevice({ deviceId: environment.TUYA_DEVICE_ID }),
    tuyaApi.getDeviceFunctions({ deviceId: environment.TUYA_DEVICE_ID }),
    tuyaApi.getDeviceStatus({ deviceId: environment.TUYA_DEVICE_ID })
  ])

  console.log(JSON.stringify({
    device: {
      id: '[redacted]',
      name: device.name,
      category: device.category,
      productName: device.product_name,
      online: device.online
    },
    functions,
    status
  }, null, 2))
  console.log('Consulta somente leitura concluída.')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido'
  console.error(`Falha na consulta Cloud: ${sanitizeError(message)}`)
  process.exitCode = 1
})

function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer xxxxxxxx')
    .replace(/(secret|token|sign|client_secret|access_token)[=:][^\s,}]+/gi, '$1=xxxxxxxx')
}
