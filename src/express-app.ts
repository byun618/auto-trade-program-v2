import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import pino from 'express-pino-logger'
import helmet from 'helmet'

export const initApp = () => {
  const app = express()

  app.use(cors())
  app.use(helmet())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(pino())

  return app
}
