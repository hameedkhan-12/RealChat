'use client'

import { useEffect, useState } from 'react'

type Domain = { id: string; name: string }

export function DomainSelector({ domains, defaultValue }: { domains: Domain[]; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  return (
    <select
      defaultValue={defaultValue}
      value={value}
      onChange={(e) => {
        const id = (e.target as HTMLSelectElement).value
        setValue(id)
        window.location.href = id ? `?domain=${id}` : '?'
      }}
      className="border rounded px-2 py-1.5 text-sm"
    >
      <option value="">All domains</option>
      {domains.map((d) => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
  )
}
