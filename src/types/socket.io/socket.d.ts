import { UserInterface, UserProgramInterface } from '@byun618/auto-trade-models'
import { Socket } from 'socket.io'

declare module 'socket.io' {
  interface Socket extends Socket {
    user?: UserInterface
    userProgram?: UserProgramInterface
  }
}
