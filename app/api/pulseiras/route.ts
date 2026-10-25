import { errorResponse, sheetGet } from "@/lib/server/sheet"

// Lista de pulseiras (aba "Pulseiras" da planilha)
export async function GET() {
  try {
    const data = await sheetGet({ action: "list" })
    return Response.json({ pulseiras: data.pulseiras })
  } catch (error) {
    return errorResponse(error)
  }
}

export const dynamic = "force-dynamic"
