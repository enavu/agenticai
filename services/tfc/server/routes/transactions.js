import express from 'express'
import multer from 'multer'
import { createReadStream } from 'fs'
import readline from 'readline'
import { query } from '../db/client.js'

const router = express.Router()
const upload = multer({ dest: '/tmp/uploads/' })

// GET /api/transactions?days=7&flagged=true
router.get('/', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  const flaggedOnly = req.query.flagged === 'true'

  const whereClause = flaggedOnly
    ? 'WHERE date >= CURRENT_DATE - $1::interval AND flagged = true'
    : 'WHERE date >= CURRENT_DATE - $1::interval'

  const result = await query(
    `SELECT * FROM transactions ${whereClause} ORDER BY date DESC LIMIT 200`,
    [`${days} days`]
  )

  // Summary stats
  const summary = await query(`
    SELECT
      COALESCE(SUM(CASE WHEN flagged THEN amount END), 0) as doordash_total,
      COUNT(CASE WHEN flagged THEN 1 END) as doordash_count,
      COALESCE(SUM(amount), 0) as total_spend,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE date >= CURRENT_DATE - $1::interval
  `, [`${days} days`])

  res.json({ transactions: result.rows, summary: summary.rows[0] })
})

// POST /api/transactions/import-doordash — CSV upload
router.post('/import-doordash', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const rl = readline.createInterface({
    input: createReadStream(req.file.path),
    crlfDelay: Infinity,
  })

  const rows = []
  let headers = null
  let imported = 0

  for await (const line of rl) {
    if (!line.trim()) continue
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
    if (!headers) {
      headers = cols.map(h => h.toLowerCase())
      continue
    }
    const row = Object.fromEntries(headers.map((h, i) => [h, cols[i]]))
    rows.push(row)
  }

  // DoorDash CSV typically has: order_date, restaurant_name, subtotal, delivery_fee, total
  for (const row of rows) {
    const date = row.order_date || row.date || row['delivery date']
    const merchant = row.restaurant_name || row.store || row.merchant || 'DoorDash Order'
    const amount = parseFloat(row.total || row.subtotal || row.amount || 0)

    if (!date || isNaN(amount)) continue

    try {
      await query(
        `INSERT INTO transactions (date, merchant, amount, category, account, flagged)
         VALUES ($1, $2, $3, 'Food Delivery', 'DoorDash CSV', true)`,
        [date, merchant, amount]
      )
      imported++

      // Also add to food_log
      await query(
        `INSERT INTO food_log (date, meal_name, source, flags)
         VALUES ($1, $2, 'doordash', $3)`,
        [date, merchant, JSON.stringify(['delivery', 'processed_food'])]
      )
    } catch (err) {
      // Skip duplicates
    }
  }

  res.json({ imported, total_rows: rows.length })
})

export default router
