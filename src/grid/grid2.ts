import { Socket } from 'socket.io'
import { USDMClient, NewFuturesOrderParams } from 'binance'
import { round, sleep } from '../public/utils'

export default class Grid2 {
  private userSymbolId: string
  private socket: Socket
  private binance: USDMClient
  private symbol: string
  private leverage: number
  private orderSize: number
  private grid: number
  private longTarget: number
  private shortTarget: number

  private started: boolean

  constructor({
    api_key,
    api_secret,
    userSymbolId,
    symbol,
    leverage,
    orderSize,
    grid,
  }) {
    this.binance = new USDMClient({
      api_key,
      api_secret,
    })
    this.userSymbolId = userSymbolId
    this.symbol = symbol
    this.started = false
    this.leverage = leverage
    this.orderSize = orderSize
    this.grid = grid
  }

  getCurrentPrice = async () => {
    const res = await this.binance.getSymbolPriceTicker({
      symbol: this.symbol,
    })
    console.log(res)
    return Number(res.price)
  }

  setLeverage = async (leverage: number) => {
    try {
      await this.binance.setLeverage({
        symbol: this.symbol,
        leverage,
      })
    } catch (err) {
      // TODO: 에러 처리
      console.error(err)
    }
  }

  getAvBalance = async () => {
    const balances = await this.binance.getBalance()
    const balance = balances.find(({ asset }) => asset === 'USDT')

    return Number(balance.availableBalance)
  }

  getPosition = async (currentPrice: number) => {
    const [position] = await this.binance.getPositions({ symbol: this.symbol })

    const initialMargin =
      (Math.abs(Number(position.positionAmt)) *
        Number(position.entryPrice) *
        1) /
      this.leverage

    const pnl =
      position.positionAmt > 0
        ? (currentPrice - Number(position.entryPrice)) *
          Number(position.positionAmt)
        : (Number(position.entryPrice) - currentPrice) *
          Number(position.positionAmt)

    const roe = pnl / initialMargin

    // const targetPrice =
    //   position.positionAmt > 0
    //     ? Number(position.entryPrice) * (0.05 / this.leverage + 1)
    //     : Number(position.entryPrice) * (1 - roe / this.leverage)

    return {
      size: position.positionAmt,
      entryPrice: position.entryPrice,
      markPrice: currentPrice,
      liqPrice: position.liquidationPrice,
      margin: initialMargin,
      marginType: position.marginType,
      pnl,
      roe: round(roe * 100),
    }

    /**
     * size
     * entryPrice
     * markPrice
     * liqPrice
     * marginRatio ?
     * margin, margin Type
     * pnl(ROE %)
     */
    // return position[0]
  }

  getAvMaxSize = (
    positionAmt: number,
    avBalance: number,
    currentPrice: number,
  ) => {
    let tmpMaxSize = (avBalance * this.leverage) / currentPrice

    if (positionAmt > 0) {
      // long이니 short을 더 할 수 있음
      return {
        longMaxSize: tmpMaxSize,
        shortMaxSize: tmpMaxSize + positionAmt * 2,
      }
    } else if (positionAmt < 0) {
      // short이니 long을 더 할 수 있음
      return {
        longMaxSize: tmpMaxSize + -positionAmt * 2,
        shortMaxSize: tmpMaxSize,
      }
    } else {
      return { longMaxSize: tmpMaxSize, shortMaxSize: tmpMaxSize }
    }
  }

  updateTarget = (price: number) => {
    this.longTarget = price - this.grid
    this.shortTarget = price + this.grid
  }

  buy = async () => {
    try {
      const res = await this.binance.submitNewOrder({
        symbol: this.symbol,
        quantity: this.orderSize,
        side: 'BUY',
        type: 'MARKET',
      })

      console.log(res)
    } catch (err) {
      console.error(err)
    }
  }

  sell = async () => {
    try {
      const res = await this.binance.submitNewOrder({
        symbol: this.symbol,
        quantity: this.orderSize,
        side: 'SELL',
        type: 'MARKET',
      })

      console.log(res)
    } catch (err) {
      console.error(err)
    }
  }

  async start() {
    this.started = true

    await this.setLeverage(this.leverage)

    const currentPrice = await this.getCurrentPrice()
    // this.updateTarget(currentPrice)

    const res = await this.binance.getSymbolPriceTicker()
    const res1 = res.map((res) => res.symbol)

    const res2 = res1.filter((sym) => sym.slice(-4) === 'USDT')
    console.log(res2)

    // while (this.started) {
    //   const currentPrice = await this.getCurrentPrice()
    //   const position = await this.getPosition(currentPrice)
    //   console.log(position)

    //   //   //   const avBalance = await this.getAvBalance()

    //   //   //   const maxSize = this.getAvMaxSize(
    //   //   //     Number(position.positionAmt),
    //   //   //     avBalance,
    //   //   //     currentPrice,
    //   //   //   )

    //   //   const currentPrice = await this.getCurrentPrice()

    //   //   console.log({
    //   //     longTarget: this.longTarget,
    //   //     shortTarget: this.shortTarget,
    //   //     currentPrice,
    //   //   })

    //   //   if (currentPrice < this.longTarget) {
    //   //     await this.buy()
    //   //     this.updateTarget(this.longTarget)

    //   //     const position = await this.getPosition()
    //   //     if (Number(position.positionAmt) === 0) {
    //   //       await this.buy()
    //   //     }
    //   //   }

    //   //   if (currentPrice > this.shortTarget) {
    //   //     await this.sell()
    //   //     this.updateTarget(this.shortTarget)

    //   //     const position = await this.getPosition()
    //   //     if (Number(position.positionAmt) === 0) {
    //   //       await this.sell()
    //   //     }
    //   //   }

    //   await sleep(1000)
    // }
  }
}
