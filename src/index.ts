import http from 'http'
import { Server } from 'socket.io'
import { initApp } from './express-app'

const PORT = process.env.APP_PORT || 3002

const serve = async () => {
  const app = initApp()
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  const ns = io.of(`/${process.env.NAMESPACE}`)

  ns.on('connection', (socket) => {
    console.log('connect')
  })

  server.listen(PORT, () => {
    console.log(`${PORT} 포트에서 서버가 시작되었습니다! 🚀  🚀`)
  })
}

serve()
