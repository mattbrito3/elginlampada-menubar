import 'dotenv/config'
import TuyAPI from 'tuyapi'
import { z } from 'zod'

const environmentSchema = z.object({
  TUYA_DEVICE_ID: z.string().min(1),
  TUYA_LOCAL_KEY: z.string().min(1),
  TUYA_DEVICE_IP: z.string().ip().optional().or(z.literal('')),
  TUYA_PROTOCOL_VERSION: z.string().optional().or(z.literal(''))
})

const environment = environmentSchema.parse({
  TUYA_DEVICE_ID: process.env.TUYA_DEVICE_ID,
  TUYA_LOCAL_KEY: process.env.TUYA_LOCAL_KEY,
  TUYA_DEVICE_IP: process.env.TUYA_DEVICE_IP,
  TUYA_PROTOCOL_VERSION: process.env.TUYA_PROTOCOL_VERSION
})

const requestedVersion = process.argv[2] ?? environment.TUYA_PROTOCOL_VERSION
if (!requestedVersion || !['3.1', '3.3', '3.4', '3.5'].includes(requestedVersion)) {
  console.error('Informe uma versão suportada para o teste: 3.1, 3.3, 3.4 ou 3.5.')
  process.exit(1)
}

const device = new TuyAPI({
  id: environment.TUYA_DEVICE_ID,
  key: environment.TUYA_LOCAL_KEY,
  ...(environment.TUYA_DEVICE_IP ? { ip: environment.TUYA_DEVICE_IP } : {}),
  version: requestedVersion,
  issueGetOnConnect: false,
  issueRefreshOnConnect: false
})

async function main(): Promise<void> {
  try {
    device.on('data', (data) => {
      console.log('Evento data recebido. DPS:', Object.keys(data.dps ?? {}).join(', ') || '(nenhum)')
    })
    device.on('dp-refresh', (data) => {
      console.log('Evento dp-refresh recebido. DPS:', Object.keys(data.dps ?? {}).join(', ') || '(nenhum)')
    })
    console.log('Procurando a lâmpada na rede local...')
    const found = await device.find()
    console.log(`Dispositivo encontrado${found ? '.' : '; o IP não foi retornado pela biblioteca.'}`)
    console.log('Versão testada:', requestedVersion)

    console.log('Conectando...')
    await device.connect()
    console.log('Conectado. Lendo o estado...')

    let state = await device.get({ schema: true })
    if (!hasDps(state)) {
      console.log('Nenhum DPS veio no get(); solicitando refresh...')
      state = await device.refresh({ schema: true })
    }
    const stateRecord = isRecord(state) ? state : {}
    const directDps = isRecord(stateRecord.dps) ? stateRecord.dps : {}
    const nestedData = isRecord(stateRecord.data) ? stateRecord.data : {}
    const nestedDps = isRecord(nestedData.dps) ? nestedData.dps : {}
    const dps = Object.keys(directDps).length > 0 ? directDps : nestedDps
    console.log('Estado recebido. DPS encontrados:', Object.keys(dps).join(', ') || '(nenhum)')
    for (const [id, value] of Object.entries(dps)) {
      console.log(`DPS ${id}: ${formatDpsValue(value)}`)
    }
    if (Object.keys(dps).length === 0) {
      console.log('Formato retornado:', Object.keys(stateRecord).join(', ') || '(sem campos)')
    }
    if (process.argv[3] !== '--toggle') {
      console.log('Teste local concluído sem enviar comandos.')
      return
    }

    const currentPower = dps['20']
    if (typeof currentPower !== 'boolean') {
      throw new Error('O DPS 20 não retornou um valor booleano; comando não enviado.')
    }

    const targetPower = !currentPower
    console.log(`Enviando comando de energia: ${targetPower ? 'ligar' : 'desligar'}...`)
    await device.set({
      multiple: true,
      data: { '20': targetPower },
      shouldWaitForResponse: false
    })
    console.log('Comando enviado sem aguardar confirmação do dispositivo.')
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const updatedDps = extractDps(await device.get({ schema: true }))
    console.log(`DPS 20 após o comando: ${String(updatedDps['20'])}`)
    console.log('Teste de energia concluído.')
  } finally {
    device.disconnect()
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasDps(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (isRecord(value.dps) && Object.keys(value.dps).length > 0) return true
  return isRecord(value.data) && isRecord(value.data.dps) && Object.keys(value.data.dps).length > 0
}

function formatDpsValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function extractDps(value: unknown): Record<string, unknown> {
  const record = isRecord(value) ? value : {}
  const directDps = isRecord(record.dps) ? record.dps : {}
  const data = isRecord(record.data) ? record.data : {}
  const nestedDps = isRecord(data.dps) ? data.dps : {}
  return Object.keys(directDps).length > 0 ? directDps : nestedDps
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido'
  console.error(`Falha no teste local: ${message}`)
  process.exitCode = 1
})
