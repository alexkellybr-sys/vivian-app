# Vívian – Controle Neonatal (v2)

App web para celular (Android/iPhone) e computador. Lê a pulseira NFC, mostra e grava os dados do bebê numa planilha Google, e vigia a pulseira por GPS com cerca e alarme.

## Como funciona

```
Celular / PC (site no GitHub Pages)  →  Google Apps Script (login com PIN)  →  Planilha
                                                 ↑ a cada minuto
                                     Traccar (opcional, rastreadores GPS)
```

- Site: `https://alexkellybr-sys.github.io/vivian-app/` (publicado sozinho a cada envio para a branch `main`)
- **Login**: usuário + PIN cadastrados na aba **Usuários** da planilha (o script cria um "Administrador" com PIN aleatório na 1ª vez). Escreva "não" em *Ativo* para cortar o acesso na hora.

- **NFC**: Android lê pelo botão "Leitura NFC" (Chrome). iPhone (e Android sem abrir o app) abre pelo link gravado na etiqueta: `https://alexkellybr-sys.github.io/vivian-app/?nfc=00011982`.
- **Planilha** (o script cria sozinho):
  - `Pulseiras` – índice com link "Abrir ▶" para a aba de cada pulseira
  - `<número>` – uma aba por pulseira: DADOS (A-B) e HISTÓRICO (D-H: data, aba, campo, valor, usuário)
  - `Cercas` e `Posições` – GPS
- **Painel do computador**: `https://alexkellybr-sys.github.io/vivian-app/painel/`
- **GPS**: cercas por toque no mapa ou digitando coordenadas; alarme (som + vibração) quando a pulseira sai da "área permitida", com setor (Norte, Nordeste…), distância e se está afastando. Fontes de posição: rastreador via Traccar, o GPS de um celular, ou modo teste.

## Arquivos principais

| Arquivo | O que é |
|---|---|
| `google-apps-script/Codigo.gs` | Código para colar no Apps Script da planilha (é o "servidor") |
| `lib/config.ts` | Link do Apps Script |
| `lib/tabs.ts` | As abas do paciente e seus campos (edite aqui para mudar campos) |
| `components/vivian/*` | Telas |
| `.github/workflows/pages.yml` | Publicação automática no GitHub Pages |

## Rastreador GPS (Traccar)

No `Codigo.gs`, preencha `TRACCAR_URL` e `TRACCAR_TOKEN`, salve e rode a função **ativarRastreador** uma vez (o Google passa a buscar as posições a cada minuto, mesmo com o app fechado). Na aba **Dados** da pulseira, preencha **GPS (IMEI)** com o identificador do aparelho no Traccar.

## Limites conhecidos

- **GF-07**: a maioria localiza só pela antena de celular (precisão de centenas de metros a km). Serve para teste; para cerca real ao ar livre use rastreador 4G com GPS. **Dentro de prédio GPS não funciona** — para maternidade o certo é etiqueta Bluetooth/RFID com leitores nas portas.
- O alarme (som/vibração) toca **com o app aberto** (celular ou PC); o registro do alarme na planilha acontece mesmo com o app fechado quando a posição vem do rastreador. O "celular como rastreador" só envia posição com a tela aberta.
- O código do site é público (GitHub Pages grátis); os dados dos bebês ficam só na planilha, protegidos pelo PIN.
- Sistema de teste — não é um dispositivo médico certificado.

## Rodar no computador (desenvolvedor)

```
npm install
npm run dev
```
