"use client"

import { asset } from "@/lib/config"

export function LoadingScreen() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset("/images/vivian-splash.jpg")} alt="Vívian" className="rounded-full object-cover w-[150px] h-[150px]" />
      <h2 className="text-xl font-bold mt-4 mb-4">Carregando Vivian...</h2>
      <div className="w-[50px] h-[50px] border-[5px] border-muted border-t-primary rounded-full animate-spin" />
    </div>
  )
}
