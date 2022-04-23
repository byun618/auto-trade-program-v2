import { UserProgramInterface } from '@byun618/auto-trade-models'
import { Socket } from 'socket.io'

export interface VbPayload {
  socket: Socket
  access: string
  secret: string
  userProgramId: string
}
