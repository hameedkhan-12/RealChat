import { FlowBuilderForm } from '@/components/flow/flow-builder-form'
import InfoBar from '@/components/infobar'

export default async function FlowBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>
}) {
  const { domain } = await searchParams
  const domainId = typeof domain === 'string' ? domain : ''
  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <FlowBuilderForm domainId={domainId} />
      </div>
    </>
  )
}
