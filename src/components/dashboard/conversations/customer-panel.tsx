type Question = {
  id: string
  question: string
  answered: string | null
  stepKey: string | null
  createdAt: Date
}

type Props = {
  customer: {
    id: string
    email: string | null
    name: string | null
    phone: string | null
    consentAt: Date | null
    chatRooms: Array<{ id: string; status: string; createdAt: Date }>
  }
  questions: Question[]
  flowCompletedAt: Date | null
}

export function CustomerPanel({ customer, questions, flowCompletedAt }: Props) {
  return (
    <div className="border-l border-border bg-muted/50 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b"><h2 className="text-sm font-bold">Lead Details</h2></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Contact</h3>
          <p className="text-sm">{customer.email}</p>
          {customer.name && <p className="text-sm">{customer.name}</p>}
          {customer.phone && <p className="text-sm">{customer.phone}</p>}
          <p className="text-xs text-muted-foreground mt-2">
            Consent: {customer.consentAt ? 'Yes' : 'No'}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Questionnaire</h3>
          <p className="text-sm text-muted-foreground">
            {flowCompletedAt ? 'Completed' : 'Incomplete'}
          </p>
          {questions.length ? (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="mb-2 p-2 rounded border border-border/50">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    {q.question}
                  </div>
                  <div className="text-sm text-muted-foreground">{q.answered || '—'}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">No answers yet</p>
          )}
        </div>

        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Related Conversations</h3>
          {customer.chatRooms.length ? (
            <ul className="space-y-2">
              {customer.chatRooms.map((r) => (
                <li key={r.id} className="text-xs text-muted-foreground flex justify-between">
                  <span>{r.id}</span>
                  <span className="font-medium">{r.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-muted-foreground">No related conversations</p>
          )}
        </div>
      </div>
    </div>
  )
}
