import { UserProgramLog } from '@byun618/auto-trade-models'
import { Socket } from 'socket.io'
import Vb from './vb'

export const initVb = async (socket: Socket, userProgramId: string) => {
  const vb = new Vb({
    socket,
    access: process.env.UPBIT_ACCESS,
    secret: process.env.UPBIT_SECRET,
    userProgramId,
  })

  const message = '성공적으로 초기화 되어 연결되었습니다.'
  await UserProgramLog.create({
    userProgram: userProgramId,
    message,
  })
  socket.emit('message', {
    message,
  })

  return vb
}

export const momentFormat = 'YYYY-MM-DD H시 m분'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const handleError = (socket: Socket, err: Error) => {
  console.error(err)
  socket.emit('error', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  })
}
