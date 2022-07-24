import { UserSymbol, UserSymbolInterface } from '@byun618/auto-trade-models'
import { USDMClient } from 'binance'
import { Socket } from 'socket.io'
import { round, sleep } from '../public/utils'

interface GridPayload {
  api_key: string
  api_secret: string
  userSymbolId: string
  socket: any
}

export default class Grid {
  private userSymbolId: string
  private socket: Socket
  private binance: USDMClient
  private longTarget: number
  private shortTarget: number

  private started: boolean

  constructor({ api_key, api_secret, userSymbolId, socket }: GridPayload) {
    this.binance = new USDMClient({
      api_key,
      api_secret,
    })
    this.userSymbolId = userSymbolId
    this.socket = socket
  }

  private getUserSymbol = async (): Promise<UserSymbolInterface> => {
    const userSymbol = await UserSymbol.findById(this.userSymbolId)
      .populate('user')
      .populate('symbol')

    return userSymbol
  }

  updateSocket = async (socket: Socket) => {
    this.socket = socket
  }

  getCurrentPrice = async (symbol: string): Promise<number> => {
    const res = await this.binance.getSymbolPriceTicker({
      symbol,
    })

    return Number(res.price)
  }

  setLeverage = async () => {
    const userSymbol = await this.getUserSymbol()

    await this.binance.setLeverage({
      symbol: userSymbol.symbol.name,
      leverage: userSymbol.leverage,
    })
  }

  updateTarget = async (currentPrice: number, profit: number) => {
    const grid = (currentPrice * profit) / 100

    this.longTarget = round(currentPrice - grid)
    this.shortTarget = round(currentPrice + grid)

    return {
      longTarget: this.longTarget,
      shortTarget: this.shortTarget,
    }
  }

  getPosition = async (symbol: string, leverage: number) => {
    const currentPrice = await this.getCurrentPrice(symbol)
    const [position] = await this.binance.getPositions({ symbol })

    const positionAmt = Number(position.positionAmt)
    const entryPrice = Number(position.entryPrice)
    const liquidationPrice = Number(position.liquidationPrice)

    const initialMargin = (Math.abs(positionAmt) * entryPrice * 1) / leverage

    const pnl =
      positionAmt === 0
        ? 0
        : positionAmt > 0
        ? (currentPrice - entryPrice) * positionAmt
        : (entryPrice - currentPrice) * positionAmt

    const roe = pnl === 0 ? 0 : pnl / initialMargin

    return {
      size: positionAmt,
      entryPrice: entryPrice,
      markPrice: currentPrice,
      liqPrice: liquidationPrice,
      margin: initialMargin,
      marginType: position.marginType,
      pnl: round(pnl),
      roe: round(roe * 100),
    }
  }

  start = async () => {
    this.started = true

    const userSymbol = await this.getUserSymbol()

    const currentPrice = await this.getCurrentPrice(userSymbol.symbol.name)

    const { longTarget, shortTarget } = await this.updateTarget(
      currentPrice,
      userSymbol.profit,
    )

    userSymbol.started = this.started
    userSymbol.longTarget = longTarget
    userSymbol.shortTarget = shortTarget
    await userSymbol.save()

    this.refreshUserSymbol()

    while (this.started) {
      const position = await this.getPosition(
        userSymbol.symbol.name,
        userSymbol.leverage,
      )
      this.refreshUserSymbolPosition(position)

      await sleep(1000)
    }
  }

  stop = async () => {
    this.started = false

    const userSymbol = await this.getUserSymbol()
    userSymbol.started = false
    await userSymbol.save()

    this.refreshUserSymbol()
  }

  refreshUserSymbol = () => {
    this.socket.emit('message', {
      type: 'refresh-user-symbol',
    })
  }

  refreshUserSymbolPosition = (position: any) => {
    this.socket.emit('message', {
      type: 'refresh-user-symbol-position',
      payload: position,
    })
  }
}
