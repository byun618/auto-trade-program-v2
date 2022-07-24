import { UserSymbolInterface } from '@byun618/auto-trade-models'
import 'socket.io'

declare module 'socket.io' {
  interface Socket extends Socket {
    userSymbol?: UserSymbolInterface
  }
}
