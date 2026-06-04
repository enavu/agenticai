import express from 'express'
import { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } from 'plaid'
import { query } from '../db/client.js'
import 'dotenv/config'

const router = express.Router()

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
})

const plaid = new PlaidApi(plaidConfig)

// Step 1: Create link token — frontend uses this to open Plaid Link
router.post('/create-link-token', async (req, res) => {
  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: 'trip-fund-user-1' },
      client_name: 'Trip Fund Coach',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })
    res.json({ link_token: response.data.link_token })
  } catch (err) {
    console.error('Plaid link token error:', err.response?.data || err.message)
    res.status(500).json({ error: 'Failed to create link token' })
  }
})

// Step 2: Exchange public token for access token
router.post('/exchange-token', async (req, res) => {
  const { public_token, institution } = req.body
  try {
    const response = await plaid.itemPublicTokenExchange({ public_token })
    const { access_token, item_id } = response.data

    await query(
      'INSERT INTO plaid_tokens (access_token, item_id, institution) VALUES ($1, $2, $3)',
      [access_token, item_id, institution || 'Unknown']
    )

    res.json({ success: true, item_id })
  } catch (err) {
    console.error('Plaid exchange error:', err.response?.data || err.message)
    res.status(500).json({ error: 'Token exchange failed' })
  }
})

// Step 3: Sync transactions for all linked accounts
router.post('/sync', async (req, res) => {
  try {
    const tokens = await query('SELECT access_token, institution FROM plaid_tokens')
    if (tokens.rows.length === 0) {
      return res.json({ synced: 0, message: 'No linked accounts' })
    }

    let totalSynced = 0

    for (const { access_token, institution } of tokens.rows) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const startDate = thirtyDaysAgo.toISOString().split('T')[0]
      const endDate = new Date().toISOString().split('T')[0]

      try {
        const txResponse = await plaid.transactionsGet({
          access_token,
          start_date: startDate,
          end_date: endDate,
          options: { count: 500 },
        })

        const transactions = txResponse.data.transactions

        for (const tx of transactions) {
          const merchant = tx.merchant_name || tx.name || 'Unknown'
          const category = tx.personal_finance_category?.primary || tx.category?.[0] || 'Uncategorized'
          const flagged = isDoorDash(merchant)

          await query(
            `INSERT INTO transactions (plaid_id, date, merchant, amount, category, account, flagged)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (plaid_id) DO UPDATE SET
               merchant = EXCLUDED.merchant,
               amount = EXCLUDED.amount,
               category = EXCLUDED.category,
               flagged = EXCLUDED.flagged`,
            [tx.transaction_id, tx.date, merchant, Math.abs(tx.amount), category, institution, flagged]
          )
          totalSynced++
        }
      } catch (itemErr) {
        console.error(`Sync error for ${institution}:`, itemErr.response?.data || itemErr.message)
      }
    }

    res.json({ synced: totalSynced })
  } catch (err) {
    console.error('Sync error:', err)
    res.status(500).json({ error: 'Sync failed' })
  }
})

// Get linked accounts
router.get('/accounts', async (req, res) => {
  const result = await query('SELECT id, item_id, institution, created_at FROM plaid_tokens ORDER BY created_at DESC')
  res.json({ accounts: result.rows })
})

function isDoorDash(merchant) {
  return /doordash|dd\s*order|dashpass/i.test(merchant)
}

export default router
