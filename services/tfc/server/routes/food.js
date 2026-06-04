import express from 'express'
import { query } from '../db/client.js'

const router = express.Router()

// Rough nutrition flags — real app would hit a nutrition API
const NUTRITION_FLAGS = {
  cholesterol: ['burger', 'steak', 'egg', 'cheese', 'bacon', 'sausage', 'wings', 'pizza'],
  sodium:      ['pizza', 'chinese', 'ramen', 'soy', 'chips', 'fast food', 'taco', 'burrito', 'sub', 'sandwich'],
  fat:         ['fries', 'fried', 'burger', 'pizza', 'wings', 'bacon', 'cheese', 'alfredo', 'cream'],
  sugar:       ['smoothie', 'shake', 'dessert', 'ice cream', 'coffee drink', 'lemonade', 'soda', 'donut', 'pastry'],
  carbs:       ['pasta', 'rice', 'bread', 'pizza', 'burrito', 'ramen', 'noodle', 'bagel', 'croissant'],
}

function detectFlags(mealName) {
  const name = mealName.toLowerCase()
  const flags = []
  for (const [flag, keywords] of Object.entries(NUTRITION_FLAGS)) {
    if (keywords.some(k => name.includes(k))) {
      flags.push(flag)
    }
  }
  return flags
}

router.get('/', async (req, res) => {
  const days = parseInt(req.query.days) || 7
  const result = await query(
    `SELECT * FROM food_log
     WHERE date >= CURRENT_DATE - $1::interval
     ORDER BY date DESC`,
    [`${days} days`]
  )
  res.json({ entries: result.rows })
})

router.post('/', async (req, res) => {
  const { date, meal_name, source = 'manual', calories } = req.body
  if (!meal_name) return res.status(400).json({ error: 'meal_name required' })

  const flags = detectFlags(meal_name)
  const d = date || new Date().toISOString().split('T')[0]

  const result = await query(
    `INSERT INTO food_log (date, meal_name, source, calories, flags)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [d, meal_name, source, calories || null, JSON.stringify(flags)]
  )
  res.status(201).json({ entry: result.rows[0] })
})

router.delete('/:id', async (req, res) => {
  await query('DELETE FROM food_log WHERE id = $1', [req.params.id])
  res.json({ deleted: true })
})

export default router
