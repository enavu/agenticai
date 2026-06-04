import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'

import plaidRouter from './routes/plaid.js'
import claudeRouter from './routes/claude.js'
import tripsRouter from './routes/trips.js'
import transactionsRouter from './routes/transactions.js'
import foodRouter from './routes/food.js'
import savingsRouter from './routes/savings.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

app.use(cors({
  origin: isProd ? false : 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

app.use('/api/plaid', plaidRouter)
app.use('/api/claude', claudeRouter)
app.use('/api/trips', tripsRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/food', foodRouter)
app.use('/api/savings', savingsRouter)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

// Serve React app in production
if (isProd) {
  const publicPath = join(__dirname, 'public')
  app.use(express.static(publicPath))
  app.get('*', (req, res) => res.sendFile(join(publicPath, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Trip Fund Coach API running on http://localhost:${PORT}`)
})
