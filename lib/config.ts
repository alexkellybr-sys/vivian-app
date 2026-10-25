// Link do "App da Web" do Apps Script da planilha (termina em /exec).
// Ele é público de propósito: sem usuário + PIN cadastrados na aba "Usuários", o script não entrega nada.
export const SCRIPT_URL =
  process.env.NEXT_PUBLIC_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbx9HHgY3WLXGrF3fzNuSHNeCh4EF3zWOFV5aq5eVF-fHDXrcFpdAcgOkVvhnQk-bWNi/exec"

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ""
export const asset = (path: string) => `${BASE_PATH}${path}`
