import { UserProgram } from '@byun618/auto-trade-models'
import http from 'http'
import { userInfo } from 'os'
import { Server, Socket } from 'socket.io'
import { initApp } from './express-app'
import auth from './public/auth'

const PORT = process.env.APP_PORT || 3001

const serve = async () => {
  const app = initApp()
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: `/${process.env.APP_PATH}`,
  })

  io.use(auth)

  io.on('connection', async (socket: Socket) => {
    const { user, userProgram } = socket

    console.log(userProgram)

    socket.on('disconnect', () => {
      console.log('disconnect')
    })
  })

  server.listen(PORT, () => {
    console.log(`${PORT} 포트에서 서버가 시작되었습니다! 🚀  🚀`)
  })
}

serve()
