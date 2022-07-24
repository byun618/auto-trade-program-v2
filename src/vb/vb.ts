import {
  UserProgram,
  UserProgramInterface,
  UserProgramLog,
  UserProgramTrade,
} from '@byun618/auto-trade-models'
import { Quotation, Upbit } from '@byun618/upbit-node'
import moment, { Moment } from 'moment-timezone'
import { Socket } from 'socket.io'
import { CurrentPriceError } from './error.helper'
import { VbPayload } from './interfaces'
import { handleError, sleep, sum } from '../public/utils'

export default class Vb {
  private socket: Socket
  private readonly quotation: Quotation
  private readonly upbit: Upbit
  private readonly userProgramId: string
  private buyTime: Moment | null
  private sellTime: Moment | null
  private started: boolean
  private targetPrice: number | null
  private isHold = false
  private isSell = false

  constructor({ socket, access, secret, userProgramId }: VbPayload) {
    this.socket = socket
    this.quotation = new Quotation()
    this.upbit = new Upbit(access, secret)
    this.userProgramId = userProgramId
    // TODO: buyTime, sellTime init 해야하나
    this.started = false
    this.targetPrice = null
  }

  private async emitMessage(message: string) {
    await UserProgramLog.create({
      userProgram: this.userProgramId,
      message,
    })
    this.socket.emit('message', { message })
  }

  async updateSocket(socket: Socket) {
    this.socket = socket

    await this.emitMessage('성공적으로 재연결되었습니다.')
  }

  private async updateTargetTime(userProgram: UserProgramInterface) {
    const buyTime = moment().set({
      hour: userProgram.startTime,
      minute: 5,
      second: 0,
      millisecond: 0,
    })

    if (moment().isAfter(buyTime.clone().add(1, 'hour'))) {
      buyTime.add(1, 'day')
    }

    const sellTime = buyTime
      .clone()
      .add(userProgram.timeInterval, 'hour')
      .subtract(15, 'minute')

    this.buyTime = buyTime
    this.sellTime = sellTime

    userProgram.buyTime = buyTime.format()
    userProgram.sellTime = sellTime.format()
    await userProgram.save()

    await this.emitMessage('성공적으로 매수/매도 시간이 업데이트 되었습니다.')
  }

  private async updateTargetPrice(userProgram: UserProgramInterface) {
    const previousTime = this.buyTime
      .clone()
      .add({
        hour: userProgram.timeInterval,
      })
      .subtract({
        day: 1,
        minute: 5,
      })

    const ticker = userProgram.ticker.market
    const previousData = await this.quotation.getOhlcvRangeBase({
      ticker,
      to: previousTime.format('YYYY-MM-DD HH:mm:ss'),
      timeInterval: userProgram.timeInterval,
    })

    // 반드시 start에서 한 시간 이내에 실행해야 의도대로 동작함
    const [currentData] = await this.quotation.getOhlcv({
      ticker,
      interval: 'minute60',
      count: 1,
    })

    const { open, high, low, close } = previousData
    const range = high - low
    const noise = 1 - Math.abs(open - close) / range

    const targetPrice = range * noise + currentData.open
    this.targetPrice = targetPrice

    userProgram.targetPrice = targetPrice
    await userProgram.save()

    await this.emitMessage('성공적으로 목표 매수가가 업데이트 되었습니다.')
  }

  async getCurrentPrice(userProgram: UserProgramInterface, emit?: boolean) {
    try {
      const { market: ticker } = userProgram.ticker
      const currentPrice = await this.quotation.getCurrentPrice(ticker)

      if (emit) {
        await this.emitMessage(`${currentPrice.toLocaleString()}원`)
      }

      return currentPrice
    } catch (err) {
      throw new CurrentPriceError(err.message)
    }
  }

  async buy(userProgram: UserProgramInterface) {
    await this.emitMessage('목표 매수가에 도달하였습니다. 매수를 진행합니다.')

    // TODO: 분산 투자
    try {
      const { market: ticker } = userProgram.ticker
      const { balance: cash } = await this.upbit.getBalance()

      const result = await this.upbit.buyMarketOrder({
        ticker,
        price: Number(cash) * 0.995,
      })

      await sleep(500)

      while (true) {
        const order = await this.upbit.getOrder(result.uuid)

        if (order && order.trades.length > 0) {
          const balance = await this.upbit.getBalance(ticker)

          if (balance) {
            await UserProgramTrade.create({
              type: 'buy',
              userProgram: userProgram._id,
              price: sum(order.trades, 'price'),
              volume: sum(order.trades, 'volume'),
              funds: sum(order.trades, 'funds'),
              fee: Number(order.paid_fee),
            })

            break
          }
        }

        await this.emitMessage('매수 주문 처리중...')

        await sleep(500)
      }

      this.isHold = true
      this.isSell = false

      userProgram.isHold = true
      userProgram.isSell = false
      await userProgram.save()

      await this.emitMessage('매수를 완료 했습니다.')
    } catch (err) {
      handleError(this.socket, err)
    }
  }

  async sell(userProgram: UserProgramInterface) {
    await this.emitMessage('목표 매도시간에 도달하였습니다. 매도를 진행합니다.')

    try {
      const { market: ticker } = userProgram.ticker
      const { balance: volume } = await this.upbit.getBalance(ticker)

      const result = await this.upbit.sellMarketOrder({
        ticker,
        volume: Number(volume),
      })

      await sleep(500)

      while (true) {
        const order = await this.upbit.getOrder(result.uuid)

        if (order && order.trades.length > 0) {
          try {
            await this.upbit.getBalance(ticker)
          } catch (err) {
            if (err.message === '보유한 코인이 아닙니다.') {
              await UserProgramTrade.create({
                type: 'sell',
                userProgram: userProgram._id,
                price: sum(order.trades, 'price'),
                volume: sum(order.trades, 'volume'),
                funds: sum(order.trades, 'funds'),
                fee: Number(order.paid_fee),
              })

              break
            }
          }
        }

        await this.emitMessage('매도 주문 처리 대기중...')
        await sleep(500)
      }

      this.isHold = false
      this.isSell = true

      userProgram.isHold = false
      userProgram.isSell = true
      await userProgram.save()

      await this.emitMessage('매도를 완료합니다.')
    } catch (err) {
      handleError(this.socket, err)
    }
  }

  async start() {
    const userProgram = await UserProgram.findById(this.userProgramId)

    this.started = true

    userProgram.started = true
    await userProgram.save()

    await this.emitMessage('프로그램이 시작되었습니다.')

    await this.updateTargetTime(userProgram)

    while (this.started) {
      try {
        const now = moment()

        if (now.isBetween(this.buyTime, this.sellTime) && !this.isHold) {
          if (!this.targetPrice) {
            await this.updateTargetPrice(userProgram)
          }

          const currentPrice = await this.getCurrentPrice(userProgram)

          if (currentPrice >= this.targetPrice) {
            await this.buy(userProgram)
          }
        }

        if (now.isAfter(this.sellTime) && !this.isHold && !this.isSell) {
          this.emitMessage('목표가에 도달하지 않았습니다.')
          await this.stop(false)
          break
        }

        if (now.isAfter(this.sellTime) && this.isHold && !this.isSell) {
          await this.sell(userProgram)
        }

        if (
          now.isAfter(this.sellTime.clone().add(10, 'minute')) &&
          !this.isHold &&
          this.isSell
        ) {
          await this.stop(false)
          break
        }

        await sleep(1000)
      } catch (err) {
        handleError(this.socket, err)

        if (err.name === 'CurrentPriceError') {
          await sleep(1000)
          continue
        } else {
          throw err
        }
      }
    }
  }

  async stop(manual: boolean = true) {
    this.started = false
    this.buyTime = null
    this.sellTime = null
    this.targetPrice = null
    this.isSell = null
    this.isHold = null

    await UserProgram.updateOne(
      {
        _id: this.userProgramId,
      },
      {
        $unset: {
          buyTime: 1,
          sellTime: 1,
          started: 1,
          targetPrice: 1,
          isSell: 1,
          isHold: 1,
        },
      },
    )

    const message = manual
      ? '프로그램이 정지되었습니다.'
      : '프로그램이 종료되었습니다.'

    await this.emitMessage(message)
  }
}
