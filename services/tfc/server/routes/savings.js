import express from 'express'
import { query } from '../db/client.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const result = await query(
    `SELECT se.*, t.name as trip_name, t.emoji
     FROM savings_events se
     JOIN trips t ON t.id = se.trip_id
     ORDER BY se.date DESC`
  )
  res.json({ events: result.rows })
})

router.post('/', async (req, res) => {
  const { trip_id, amount, date, note } = req.body
  if (!trip_id || !amount) return res.status(400).json({ error: 'trip_id and amount required' })

  const d = date || new Date().toISOString().split('T')[0]

  // Insert event
  const event = await query(
    `INSERT INTO savings_events (trip_id, amount, date, note)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [trip_id, amount, d, note || null]
  )

  // Update trip saved_usd
  await query(
    `UPDATE trips SET saved_usd = (
       SELECT COALESCE(SUM(amount), 0) FROM savings_events WHERE trip_id = $1
     ) WHERE id = $1`,
    [trip_id]
  )

  res.status(201).json({ event: event.rows[0] })
})

export default router
