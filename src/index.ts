import http from 'http'
import { Server, Socket } from 'socket.io'
import { initApp } from './express-app'
import Grid from './grid/grid'
import auth from './public/auth'
import { handleError, initVb } from './public/utils'
import Vb from './vb/vb'

const PORT = process.env.APP_PORT || 3001

let program: Grid

const serve = async () => {
  const app = initApp()
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: `/${process.env.USER_SYMBOL_ID}`,
  })

  io.use(auth)
    .on('connection', async (socket: Socket) => {
      const { userSymbol } = socket

      if (!program) {
        program = new Grid({
          api_key: process.env.BINANCE_API_KEY,
          api_secret: process.env.BINANCE_SECRET_KEY,
          userSymbolId: userSymbol.id,
          socket,
        })
      } else {
        program.updateSocket(socket)
      }

      socket.on('start', async () => {
        try {
          console.log(
            `${userSymbol.user.name}-${userSymbol.id}-${userSymbol.symbol.name}: 시작`,
          )
          program.start()
        } catch {
          console.error()
        }
      })

      socket.on('stop', async () => {
        try {
          console.log(
            `${userSymbol.user.name}-${userSymbol.id}-${userSymbol.symbol.name}: 종료`,
          )
          program.stop()
        } catch {
          console.error()
        }
      })

      // socket.on('current-price', async () => {
      //   try {
      //     await program.getCurrentPrice(userProgram, true)
      //   } catch (err) {
      //     handleError(socket, err)
      //   }
      // })

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
