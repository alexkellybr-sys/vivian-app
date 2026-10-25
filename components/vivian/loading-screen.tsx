"use client"

import Image from "next/image"

export function LoadingScreen() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center">
      <Image src="/images/vivian-splash.jpg" alt="Vívian" width={150} height={150} className="rounded-full object-cover w-[150px] h-[150px]" />
      <h2 className="text-xl font-bold mt-4 mb-4">Carregando Vivian...</h2>
      <div className="w-[50px] h-[50px] border-[5px] border-muted border-t-primary rounded-full animate-spin" />
    </div>
  )
}
