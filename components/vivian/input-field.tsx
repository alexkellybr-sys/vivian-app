"use client"

interface InputFieldProps {
  label: string
  type: string
  defaultValue?: string
}

export function InputField({ label, type, defaultValue }: InputFieldProps) {
  return (
    <div className="mb-4 text-left px-5">
      <label className="block text-[13px] mb-1 font-bold">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="w-full p-3 rounded-[15px] border border-primary bg-white outline-none"
      />
    </div>
  )
}
