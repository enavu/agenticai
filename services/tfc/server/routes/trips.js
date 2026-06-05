import express from 'express'
import { query } from '../db/client.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const result = await query(`
    SELECT
      t.*,
      COALESCE(SUM(se.amount), 0)::numeric as total_saved,
      t.date - CURRENT_DATE as days_remaining
    FROM trips t
    LEFT JOIN savings_events se ON se.trip_id = t.id
    GROUP BY t.id
    ORDER BY t.date ASC
  `)
  res.json({ trips: result.rows })
})

router.patch('/:id/saved', async (req, res) => {
  const { id } = req.params
  const { saved_usd } = req.body
  const result = await query(
    'UPDATE trips SET saved_usd = $1 WHERE id = $2 RETURNING *',
    [saved_usd, id]
  )
  res.json({ trip: result.rows[0] })
})

router.patch('/:id/flight', async (req, res) => {
  const { id } = req.params
  const { flight_price_usd, flight_notes } = req.body
  const result = await query(
    'UPDATE trips SET flight_price_usd = $1, flight_notes = $2 WHERE id = $3 RETURNING *',
    [flight_price_usd ?? null, flight_notes ?? null, id]
  )
  res.json({ trip: result.rows[0] })
})

export default router
