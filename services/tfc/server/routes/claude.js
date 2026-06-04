import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { query } from '../db/client.js'
import { PERSONA_PROMPTS, USER_CONTEXT } from '../lib/personas.js'
import 'dotenv/config'

const router = express.Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'

// POST /api/claude/coach
// body: { mood, prompt_type: 'trips' | 'spending' | 'food', extra_context? }
router.post('/coach', async (req, res) => {
  const { mood = 'funny', prompt_type, extra_context = '' } = req.body

  const persona = PERSONA_PROMPTS[mood] || PERSONA_PROMPTS.funny
  const systemPrompt = `${persona}\n\n${USER_CONTEXT}`

  let dataContext = ''

  try {
    if (prompt_type === 'trips') {
      const trips = await query(`
        SELECT t.*,
          COALESCE(SUM(se.amount), 0) as total_saved,
          t.date - CURRENT_DATE as days_remaining
        FROM trips t
        LEFT JOIN savings_events se ON se.trip_id = t.id
        GROUP BY t.id
        ORDER BY t.date ASC
      `)
      dataContext = buildTripsContext(trips.rows)
    }

    if (prompt_type === 'spending') {
      const txns = await query(`
        SELECT * FROM transactions
        WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY date DESC
        LIMIT 100
      `)
      const doordash = await query(`
        SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
        FROM transactions
        WHERE flagged = true
          AND date >= CURRENT_DATE - INTERVAL '7 days'
      `)
      dataContext = buildSpendingContext(txns.rows, doordash.rows[0])
    }

    if (prompt_type === 'food') {
      const food = await query(`
        SELECT * FROM food_log
        WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY date DESC
      `)
      dataContext = buildFoodContext(food.rows)
    }

    const userMessage = `${dataContext}\n\n${extra_context}`.trim()

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const response = message.content[0]?.text || 'No response generated.'
    res.json({ response, mood })
  } catch (err) {
    console.error('Claude error:', err)
    res.status(500).json({ error: 'Claude call failed', details: err.message })
  }
})

function buildTripsContext(trips) {
  const lines = trips.map(t => {
    const saved = parseFloat(t.total_saved) || 0
    const budget = parseFloat(t.budget_usd)
    const remaining = budget - saved
    const days = parseInt(t.days_remaining) || 0
    const weeksLeft = Math.max(1, Math.ceil(days / 7))
    const weeklyNeeded = (remaining / weeksLeft).toFixed(2)
    const pct = Math.round((saved / budget) * 100)
    return `• ${t.emoji} ${t.name} (${t.subtitle}): $${saved.toFixed(2)} saved of $${budget.toFixed(2)} budget (${pct}%), $${remaining.toFixed(2)} still needed, ${days} days away, need $${weeklyNeeded}/week to hit goal`
  })
  return `TRIP SAVINGS STATUS:\n${lines.join('\n')}\n\nThe user is asking: "Am I on track?" — give them your honest assessment.`
}

function buildSpendingContext(txns, doordash) {
  const ddTotal = parseFloat(doordash?.total || 0).toFixed(2)
  const ddCount = parseInt(doordash?.count || 0)

  const byCategory = txns.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount)
    return acc
  }, {})

  const categoryLines = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([cat, amt]) => `  ${cat}: $${amt.toFixed(2)}`)
    .join('\n')

  const recentDoorDash = txns
    .filter(t => t.flagged)
    .slice(0, 5)
    .map(t => `  ${t.date}: ${t.merchant} — $${parseFloat(t.amount).toFixed(2)}`)
    .join('\n')

  return `LAST 7 DAYS SPENDING:
Total transactions: ${txns.length}
DoorDash orders: ${ddCount} orders totaling $${ddTotal}

By category:
${categoryLines}

Recent DoorDash charges:
${recentDoorDash || '  (none)'}

User is asking: "How am I doing?" — give them your read on this week's spending.`
}

function buildFoodContext(entries) {
  if (entries.length === 0) return 'FOOD LOG: No entries this week. User has not logged any meals.'

  const lines = entries.map(e => {
    const flags = Array.isArray(e.flags) ? e.flags.join(', ') : JSON.stringify(e.flags)
    return `  ${e.date}: ${e.meal_name} (${e.source})${e.calories ? ` — ${e.calories} cal` : ''}${flags ? ` [flags: ${flags}]` : ''}`
  })

  const doorDashMeals = entries.filter(e => e.source === 'doordash').length
  const totalCals = entries.reduce((sum, e) => sum + (e.calories || 0), 0)

  return `FOOD LOG — LAST 7 DAYS:
Total entries: ${entries.length}
DoorDash-sourced meals: ${doorDashMeals}
Total tracked calories: ${totalCals}

Meals:
${lines.join('\n')}

User is asking: "Check my diet" — give them a full assessment knowing they do CycleBar 5x/week.`
}

export default router
