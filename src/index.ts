import http from 'http'
import { Server, Socket } from 'socket.io'
import { initApp } from './express-app'
import auth from './public/auth'
import { handleError, initVb } from './vb/utils'
import Vb from './vb/vb'

const PORT = process.env.APP_PORT || 3001

let program: Vb

const serve = async () => {
  const app = initApp()
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: `/${process.env.APP_PATH}`,
  })

  io.use(auth)
    .on('connection', async (socket: Socket) => {
      const { user, userProgram } = socket

      // TODO: socket 메세지를 class에서 보낼지 여기서 보낼지

      if (!program) {
        program = await initVb(socket, userProgram.id)
      } else {
        await program.updateSocket(socket)
      }

      socket.on('start', async () => {
        try {
          console.log(
            `${userProgram.user.name}-${userProgram.no}-${userProgram.ticker.market}: 시작`,
          )
          await program.start()
        } catch (err) {
          handleError(socket, err)
        }
      })

      socket.on('stop', async () => {
        try {
          console.log(
            `${userProgram.user.name}-${userProgram.no}-${userProgram.ticker.market}: 정지`,
          )
          await program.stop()
        } catch (err) {
          handleError(socket, err)
        }
      })

      socket.on('current-price', async () => {
        try {
          await program.getCurrentPrice(userProgram, true)
        } catch (err) {
          handleError(socket, err)
        }
      })

      socket.on('disconnect', () => {
        console.log('disconnect')
      })
    })
    .on('error', (err, next) => {
      console.log(err)
      next(err)
    })

  server.listen(PORT, () => {
    console.log(`${PORT} 포트에서 서버가 시작되었습니다! 🚀  🚀`)
  })
}

serve()
