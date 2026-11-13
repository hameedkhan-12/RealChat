import 'server-only'
import { client } from '@/lib/prisma'

export function tenantDb(domainId: string) {
  if (!domainId) throw new Error('TENANT_SCOPE_REQUIRED')
  return {
    domainId,
    customer: {
      findMany: (args: any = {}) => client.customer.findMany({ ...args, where: { ...(args.where || {}), domainId } }),
      findFirst: (args: any = {}) => client.customer.findFirst({ ...args, where: { ...(args.where || {}), domainId } }),
      create: (args: any) => client.customer.create({ ...args, data: { ...(args.data || {}), domainId } }),
      update: (args: any) => client.customer.update({ ...args, where: { ...(args.where || {}), id: args.where?.id, domainId } }),
    },
    chatRoom: {
      findMany: (args: any = {}) => client.chatRoom.findMany({ ...args, where: { ...(args.where || {}), domainId } }),
      findFirst: (args: any = {}) => client.chatRoom.findFirst({ ...args, where: { ...(args.where || {}), domainId } }),
      findUnique: (args: any) => client.chatRoom.findFirst({ ...args, where: { id: args.where?.id, domainId } }),
      update: (args: any) => client.chatRoom.update({ ...args, where: { id: args.where?.id } }),
      create: (args: any) => client.chatRoom.create({ ...args, data: { ...(args.data || {}), domainId } }),
    },
    flowStep: {
      findMany: (args: any = {}) => client.flowStep.findMany({ ...args, where: { ...(args.where || {}), domainId } }),
      findFirst: (args: any = {}) => client.flowStep.findFirst({ ...args, where: { ...(args.where || {}), domainId } }),
    },
    booking: {
      findMany: (args: any = {}) => client.booking.findMany({ ...args, where: { ...(args.where || {}), domainId } }),
      findFirst: (args: any = {}) => client.booking.findFirst({ ...args, where: { ...(args.where || {}), domainId } }),
      create: (args: any) => client.booking.create({ ...args, data: { ...(args.data || {}), domainId } }),
    },
  }
}
