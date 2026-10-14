# Elgin Lampada

Aplicativo Electron para controlar uma lâmpada Elgin pela Tuya Cloud API.

## Estado atual

O projeto inicial já contém:

- estrutura Electron com `main`, `preload` e `renderer`;
- janela frameless que abre pela bandeja;
- instância única;
- ponte IPC restrita com `contextIsolation`;
- painel visual inicial em React;
- leitura da presença das variáveis Tuya no `.env`.
- integração Cloud somente leitura e controle de energia pelo Electron.

A integração Cloud já foi validada com o dispositivo. O painel consulta o estado real e o botão de energia usa `switch_led` pela Tuya Cloud API. Brilho, cor, temperatura, seletor HSV e favoritos persistidos localmente estão disponíveis no painel.

Os favoritos são armazenados no diretório de dados do usuário do Electron, em
`favorites.json`. Eles contêm apenas parâmetros de iluminação; credenciais Tuya
nunca são gravadas nesse arquivo.

## Configuração

```powershell
Copy-Item .env.example .env
```

Preencha o `.env` localmente. Não envie o `TUYA_CLIENT_SECRET` pelo chat e não o versione.

## Desenvolvimento

```powershell
npm install
npm run dev
```

## Instalação no Windows

Para gerar os arquivos de distribuição:

```powershell
npm run dist
```

O instalador e a versão portátil serão criados em `release/`. O instalador
cria atalho no Menu Iniciar e na área de trabalho.

As credenciais não são incluídas no executável. Depois de instalar, copie o
arquivo `.env` para o diretório de dados mostrado pelo aplicativo ou, por
padrão, para:

```text
%APPDATA%\Elgin Lampada\.env
```

Use o mesmo conteúdo do `.env` utilizado no desenvolvimento. Depois disso,
abra o aplicativo pelo atalho, sem usar o terminal.

## Testes de integração

Os testes abaixo usam a lâmpada real e não devem ser executados com o app Tuya
aberto ao mesmo tempo:

```powershell
npm run lamp:inspect-cloud
npm run lamp:test-cloud-power
npm run lamp:test-cloud-light
```

Os scripts de teste de controle restauram o estado original quando possível.
