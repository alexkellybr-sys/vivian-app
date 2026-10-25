# Vívian – Controle Neonatal (v2)

App web para celular (Android/iPhone) e computador. Lê a pulseira NFC, mostra e grava os dados do bebê numa planilha Google, e vigia a pulseira por GPS com cerca e alarme.

## Como funciona

```
Celular / PC (app)  →  Vercel (rotas /api)  →  Google Apps Script  →  Planilha
                                   ↑
                         Traccar (opcional, rastreadores GPS)
```

- **NFC**: Android lê pelo botão "Leitura NFC" (Chrome). iPhone abre pelo link gravado na etiqueta: `https://SEU-SITE/?nfc=00011982`.
- **Planilha** (o script cria sozinho):
  - `Pulseiras` – índice com link "Abrir ▶" para a aba de cada pulseira
  - `<número>` – uma aba por pulseira: DADOS (A-B) e HISTÓRICO (D-H: data, aba, campo, valor, usuário)
  - `Cercas` e `Posições` – GPS
- **Painel do computador**: `https://SEU-SITE/painel`
- **GPS**: cercas por toque no mapa ou digitando coordenadas; alarme (som + vibração) quando a pulseira sai da "área permitida", com setor (Norte, Nordeste…), distância e se está afastando. Fontes de posição: rastreador via Traccar, o GPS de um celular, ou modo teste.

## Arquivos principais

| Arquivo | O que é |
|---|---|
| `google-apps-script/Codigo.gs` | Código para colar no Apps Script da planilha |
| `lib/tabs.ts` | As abas do paciente e seus campos (edite aqui para mudar campos) |
| `lib/server/sheet.ts` | Link do Apps Script e token |
| `lib/server/traccar.ts` | Ligação com servidor de rastreamento |
| `components/vivian/*` | Telas |

## Variáveis na Vercel (opcionais)

| Variável | Para quê |
|---|---|
| `APPS_SCRIPT_URL` | Trocar o link do Apps Script sem mexer no código |
| `APPS_SCRIPT_TOKEN` | Trocar o token (tem que ser igual ao do `Codigo.gs`) |
| `TRACCAR_URL`, `TRACCAR_TOKEN` (ou `TRACCAR_USER` + `TRACCAR_PASSWORD`) | Ligar rastreadores GPS reais |

Para ligar um rastreador a uma pulseira: na aba **Dados** da pulseira, preencha **GPS (IMEI)** com o identificador do aparelho no Traccar.

## Limites conhecidos

- **GF-07**: a maioria localiza só pela antena de celular (precisão de centenas de metros a km). Serve para teste; para cerca real ao ar livre use rastreador 4G com GPS. **Dentro de prédio GPS não funciona** — para maternidade o certo é etiqueta Bluetooth/RFID com leitores nas portas.
- O alarme toca **com o app aberto** (celular ou PC). O "celular como rastreador" só envia posição com a tela aberta.
- Login ainda é simbólico (só guarda o nome da enfermeira para o histórico).
- Sistema de teste — não é um dispositivo médico certificado.

## Rodar no computador (desenvolvedor)

```
npm install
npm run dev
```
