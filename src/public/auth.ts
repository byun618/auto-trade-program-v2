import jwt from 'jsonwebtoken'
import { Socket } from 'socket.io'
import { User, UserProgram } from '@byun618/auto-trade-models'

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

    const userProgram = await UserProgram.findOne({
      user: user._id,
      no: process.env.APP_PATH.split('-')[1],
    }).populate('user')

    socket.user = user
    socket.userProgram = userProgram

    next()
  } catch (err) {
    next(err)
  }
}
