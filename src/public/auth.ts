import jwt from 'jsonwebtoken'
import { Socket } from 'socket.io'
import { User, UserProgram, UserSymbol } from '@byun618/auto-trade-models'

export default async (socket: Socket, next) => {
  try {
    const { token } = socket.handshake.auth

    if (!token) {
      throw new Error('no token')
    }

    const { userId } = jwt.verify(token, process.env.AUTH_SALT as string) as {
      userId: string
    }
    const user = await User.findOne({
      id: userId,
    })

    if (!user) {
      throw new Error('not user')
    }

    const userSymbol = await UserSymbol.findOne({
      id: process.env.USER_SYMBOL_ID,
    })
      .populate('symbol')
      .populate('user')

    if (!userSymbol) {
      throw new Error('no user symbol')
    }

    socket.userSymbol = userSymbol

    next()
  } catch (err) {
    next(err)
  }
}
