'use client'

type Domain = { id: string; name: string }

export function DomainSelector({ domains, defaultValue }: { domains: Domain[]; defaultValue: string }) {
  return (
    <select
      value={defaultValue}
      onChange={(e) => {
        const id = (e.target as HTMLSelectElement).value
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
