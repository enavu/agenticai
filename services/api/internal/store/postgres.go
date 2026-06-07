package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/google/uuid"

	"enavu-hub/api/internal/models"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

// ─── Migrations ──────────────────────────────────────────────────────────────

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, schema)
	return err
}

const schema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS workouts (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_date    TIMESTAMPTZ NOT NULL,
    class_name    TEXT NOT NULL,
    instructor    TEXT NOT NULL DEFAULT '',
    studio        TEXT NOT NULL DEFAULT '',
    duration_minutes INT NOT NULL DEFAULT 45,
    cals_burned   INT,
    avg_output    INT,
    total_output  INT,
    rank          TEXT,
    raw_data      JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workouts_class_date_name_idx ON workouts(class_date, class_name, instructor);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    caption           TEXT NOT NULL,
    image_url         TEXT,
    instagram_id      TEXT,
    status            TEXT NOT NULL DEFAULT 'draft',
    workout_ids       TEXT[] NOT NULL DEFAULT '{}',
    agent_run_id      TEXT,
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_runs (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_type    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'running',
    input         TEXT NOT NULL,
    output        TEXT,
    steps_json    JSONB NOT NULL DEFAULT '[]',
    error         TEXT,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    agent_run_id    TEXT REFERENCES agent_runs(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ha_state_changes (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    entity_id   TEXT NOT NULL,
    state       TEXT NOT NULL,
    attributes  JSONB,
    changed_at  TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ha_state_changes_entity_time_uidx ON ha_state_changes(entity_id, changed_at);
CREATE INDEX IF NOT EXISTS ha_state_changes_entity_idx ON ha_state_changes(entity_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS ha_state_changes_changed_at_idx ON ha_state_changes(changed_at DESC);

CREATE TABLE IF NOT EXISTS lease_agreements (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name             TEXT NOT NULL,
    person_name      TEXT NOT NULL,
    total_amount     NUMERIC(12,2) NOT NULL,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    expected_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_day      INT NOT NULL DEFAULT 15,
    notes            TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lease_agreements ADD COLUMN IF NOT EXISTS payment_day INT NOT NULL DEFAULT 15;

CREATE TABLE IF NOT EXISTS lease_payments (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agreement_id     TEXT NOT NULL REFERENCES lease_agreements(id) ON DELETE CASCADE,
    amount_expected  NUMERIC(12,2) NOT NULL,
    amount_paid      NUMERIC(12,2) NOT NULL,
    due_date         DATE NOT NULL,
    paid_date        DATE,
    status           TEXT NOT NULL DEFAULT 'on_time',
    notes            TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_watches (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type        TEXT NOT NULL,
    label       TEXT NOT NULL,
    config      JSONB NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_prices (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    watch_id    TEXT NOT NULL REFERENCES travel_watches(id),
    price       NUMERIC(10,2) NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'USD',
    details     JSONB,
    checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS travel_prices_watch_checked_idx ON travel_prices(watch_id, checked_at DESC);

INSERT INTO travel_watches (id, type, label, config) VALUES
  ('watch-den-cdg-sep26', 'flight', 'DEN → Paris (Sep 2026)',
   '{"origin":"DEN","destination":"CDG","month":"2026-09"}'::jsonb),
  ('watch-celine-paris-sep26', 'ticket', 'Celine Dion — Paris (Sep 2026)',
   '{"artist":"Celine Dion","city":"Paris","month":"2026-09"}'::jsonb),
  ('watch-den-bwi-aug26', 'flight', 'DEN → Baltimore (Aug 8–12 2026)',
   '{"origin":"DEN","destination":"BWI","dates":"2026-08-08/2026-08-12"}'::jsonb),
  ('watch-den-las-nov26', 'flight', 'DEN → Las Vegas (Nov 13–14 2026)',
   '{"origin":"DEN","destination":"LAS","dates":"2026-11-13/2026-11-14"}'::jsonb),
  ('watch-lisa-vegas-nov26', 'ticket', 'LISA — Las Vegas (Nov 13–14 2026)',
   '{"artist":"LISA","city":"Las Vegas","venue":"Colosseum at Caesars Palace","dates":"2026-11-13/2026-11-14"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS plaid_items (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_id          TEXT NOT NULL UNIQUE,
    access_token     TEXT NOT NULL,
    institution_name TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plaid_transactions (
    id            TEXT PRIMARY KEY,
    item_id       TEXT NOT NULL REFERENCES plaid_items(item_id) ON DELETE CASCADE,
    account_id    TEXT NOT NULL,
    amount        NUMERIC(12,2) NOT NULL,
    date          DATE NOT NULL,
    name          TEXT NOT NULL,
    merchant_name TEXT NOT NULL DEFAULT '',
    category      TEXT[] NOT NULL DEFAULT '{}',
    pending       BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plaid_transactions_date_idx ON plaid_transactions(date DESC);
CREATE INDEX IF NOT EXISTS plaid_transactions_item_idx ON plaid_transactions(item_id, date DESC);

CREATE TABLE IF NOT EXISTS ha_insights (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date        DATE NOT NULL UNIQUE,
    summary     TEXT NOT NULL,
    raw_data    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ha_insights_date_idx ON ha_insights(date DESC);

CREATE TABLE IF NOT EXISTS workout_insights (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    summary     TEXT NOT NULL,
    patterns    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workout_insights_created_idx ON workout_insights(created_at DESC);
`

// ─── Workouts ─────────────────────────────────────────────────────────────────

func (s *Store) ListWorkouts(ctx context.Context, limit int) ([]models.Workout, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, class_date, class_name, instructor, studio, duration_minutes,
		       cals_burned, avg_output, total_output, rank, raw_data, created_at
		FROM workouts ORDER BY class_date DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workouts []models.Workout
	for rows.Next() {
		var w models.Workout
		if err := rows.Scan(&w.ID, &w.ClassDate, &w.ClassName, &w.Instructor,
			&w.Studio, &w.Duration, &w.CalsBurned, &w.AvgOutput,
			&w.TotalOutput, &w.Rank, &w.RawData, &w.CreatedAt); err != nil {
			return nil, err
		}
		workouts = append(workouts, w)
	}
	return workouts, nil
}

func (s *Store) UpsertWorkout(ctx context.Context, w *models.Workout) error {
	if w.ID == "" {
		w.ID = uuid.NewString()
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO workouts (id, class_date, class_name, instructor, studio, duration_minutes,
		    cals_burned, avg_output, total_output, rank, raw_data)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (class_date, class_name, instructor) DO UPDATE SET
		    cals_burned = EXCLUDED.cals_burned,
		    avg_output = EXCLUDED.avg_output,
		    total_output = EXCLUDED.total_output,
		    rank = EXCLUDED.rank,
		    raw_data = EXCLUDED.raw_data`,
		w.ID, w.ClassDate, w.ClassName, w.Instructor, w.Studio, w.Duration,
		w.CalsBurned, w.AvgOutput, w.TotalOutput, w.Rank, w.RawData)
	return err
}

func (s *Store) GetWorkoutStats(ctx context.Context) (*models.WorkoutStats, error) {
	var stats models.WorkoutStats
	err := s.pool.QueryRow(ctx, `
		SELECT
		    (COUNT(*)::int + COALESCE((SELECT value::int FROM settings WHERE key='workout_ride_offset'), 0)),
		    (COALESCE(SUM(cals_burned), 0)::int + COALESCE((SELECT value::int FROM settings WHERE key='calorie_offset'), 0)),
		    (COALESCE(SUM(duration_minutes), 0)::int + COALESCE((SELECT value::int FROM settings WHERE key='minutes_offset'), 0)),
		    COALESCE(AVG(cals_burned), 0)::float,
		    COALESCE(MIN(class_date), NOW()),
		    COALESCE(MAX(class_date), NOW()),
		    COUNT(*) FILTER (WHERE class_date >= date_trunc('month', NOW()))::int
		FROM workouts`).Scan(&stats.TotalWorkouts, &stats.TotalCalories,
		&stats.TotalMinutes, &stats.AvgCalories, &stats.FirstWorkout,
		&stats.LastWorkout, &stats.WorkoutsThisMonth)
	return &stats, err
}

func (s *Store) GetRecentWorkouts(ctx context.Context, n int) ([]models.Workout, error) {
	return s.ListWorkouts(ctx, n)
}

// ─── Posts ────────────────────────────────────────────────────────────────────

func (s *Store) ListPosts(ctx context.Context, limit int) ([]models.Post, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, caption, image_url, instagram_id, status, workout_ids,
		       agent_run_id, published_at, created_at
		FROM posts ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var p models.Post
		if err := rows.Scan(&p.ID, &p.Caption, &p.ImageURL, &p.InstagramID,
			&p.Status, &p.WorkoutIDs, &p.AgentRunID, &p.PublishedAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, nil
}

func (s *Store) CreatePost(ctx context.Context, p *models.Post) error {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	p.CreatedAt = time.Now()
	_, err := s.pool.Exec(ctx, `
		INSERT INTO posts (id, caption, image_url, instagram_id, status, workout_ids, agent_run_id, published_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		p.ID, p.Caption, p.ImageURL, p.InstagramID, p.Status,
		p.WorkoutIDs, p.AgentRunID, p.PublishedAt, p.CreatedAt)
	return err
}

func (s *Store) UpdatePost(ctx context.Context, p *models.Post) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE posts SET caption=$1, image_url=$2, instagram_id=$3, status=$4,
		    workout_ids=$5, agent_run_id=$6, published_at=$7
		WHERE id=$8`,
		p.Caption, p.ImageURL, p.InstagramID, p.Status,
		p.WorkoutIDs, p.AgentRunID, p.PublishedAt, p.ID)
	return err
}

// ─── Agent Runs ───────────────────────────────────────────────────────────────

func (s *Store) CreateAgentRun(ctx context.Context, run *models.AgentRun) error {
	if run.ID == "" {
		run.ID = uuid.NewString()
	}
	run.StartedAt = time.Now()
	stepsJSON, _ := json.Marshal([]models.AgentStep{})
	_, err := s.pool.Exec(ctx, `
		INSERT INTO agent_runs (id, agent_type, status, input, steps_json, started_at)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		run.ID, run.AgentType, run.Status, run.Input, stepsJSON, run.StartedAt)
	return err
}

func (s *Store) UpdateAgentRun(ctx context.Context, run *models.AgentRun) error {
	stepsJSON, _ := json.Marshal(run.Steps)
	_, err := s.pool.Exec(ctx, `
		UPDATE agent_runs SET status=$1, output=$2, steps_json=$3, error=$4, completed_at=$5
		WHERE id=$6`,
		run.Status, run.Output, stepsJSON, run.Error, run.CompletedAt, run.ID)
	return err
}

func (s *Store) GetAgentRun(ctx context.Context, id string) (*models.AgentRun, error) {
	var run models.AgentRun
	var stepsJSON []byte
	err := s.pool.QueryRow(ctx, `
		SELECT id, agent_type, status, input, output, steps_json, error, started_at, completed_at
		FROM agent_runs WHERE id=$1`, id).
		Scan(&run.ID, &run.AgentType, &run.Status, &run.Input, &run.Output,
			&stepsJSON, &run.Error, &run.StartedAt, &run.CompletedAt)
	if err != nil {
		return nil, err
	}
	json.Unmarshal(stepsJSON, &run.Steps)
	return &run, nil
}

func (s *Store) ListAgentRuns(ctx context.Context, limit int) ([]models.AgentRun, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_type, status, input, output, steps_json, error, started_at, completed_at
		FROM agent_runs ORDER BY started_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []models.AgentRun
	for rows.Next() {
		var run models.AgentRun
		var stepsJSON []byte
		if err := rows.Scan(&run.ID, &run.AgentType, &run.Status, &run.Input,
			&run.Output, &stepsJSON, &run.Error, &run.StartedAt, &run.CompletedAt); err != nil {
			return nil, err
		}
		json.Unmarshal(stepsJSON, &run.Steps)
		runs = append(runs, run)
	}
	return runs, nil
}

// ─── Conversations ────────────────────────────────────────────────────────────

func (s *Store) CreateConversation(ctx context.Context) (*models.Conversation, error) {
	conv := &models.Conversation{
		ID:        uuid.NewString(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO conversations (id, created_at, updated_at) VALUES ($1,$2,$3)`,
		conv.ID, conv.CreatedAt, conv.UpdatedAt)
	return conv, err
}

func (s *Store) AddMessage(ctx context.Context, msg *models.Message) error {
	if msg.ID == "" {
		msg.ID = uuid.NewString()
	}
	msg.CreatedAt = time.Now()
	_, err := s.pool.Exec(ctx, `
		INSERT INTO messages (id, conversation_id, role, content, agent_run_id, created_at)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		msg.ID, msg.ConversationID, msg.Role, msg.Content, msg.AgentRunID, msg.CreatedAt)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `UPDATE conversations SET updated_at=NOW() WHERE id=$1`,
		msg.ConversationID)
	return err
}

func (s *Store) GetConversationMessages(ctx context.Context, convID string) ([]models.Message, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, conversation_id, role, content, agent_run_id, created_at
		FROM messages WHERE conversation_id=$1 ORDER BY created_at ASC`, convID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []models.Message
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content,
			&m.AgentRunID, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, nil
}

// ─── HA State Changes ─────────────────────────────────────────────────────────

func (s *Store) GetLatestHAChangeTime(ctx context.Context) (time.Time, error) {
	var t time.Time
	err := s.pool.QueryRow(ctx, `SELECT COALESCE(MAX(changed_at), '1970-01-01') FROM ha_state_changes`).Scan(&t)
	return t, err
}

func (s *Store) BulkInsertHAStateChanges(ctx context.Context, changes []models.HAStateChange) (int, error) {
	if len(changes) == 0 {
		return 0, nil
	}
	batch := &pgx.Batch{}
	for _, c := range changes {
		attrJSON, _ := json.Marshal(c.Attributes)
		batch.Queue(`
			INSERT INTO ha_state_changes (entity_id, state, attributes, changed_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (entity_id, changed_at) DO NOTHING`,
			c.EntityID, c.State, attrJSON, c.ChangedAt)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()

	inserted := 0
	for range changes {
		ct, err := br.Exec()
		if err != nil {
			return inserted, err
		}
		inserted += int(ct.RowsAffected())
	}
	return inserted, nil
}

func (s *Store) ListHAStateChanges(ctx context.Context, entityID string, hours, limit int) ([]models.HAStateChange, error) {
	var rows pgx.Rows
	var err error
	if entityID != "" {
		rows, err = s.pool.Query(ctx, `
			SELECT id, entity_id, state, attributes, changed_at, recorded_at
			FROM ha_state_changes
			WHERE entity_id = $1 AND changed_at >= NOW() - make_interval(hours => $2)
			ORDER BY changed_at DESC LIMIT $3`, entityID, hours, limit)
	} else {
		rows, err = s.pool.Query(ctx, `
			SELECT id, entity_id, state, attributes, changed_at, recorded_at
			FROM ha_state_changes
			WHERE changed_at >= NOW() - make_interval(hours => $1)
			ORDER BY changed_at DESC LIMIT $2`, hours, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var changes []models.HAStateChange
	for rows.Next() {
		var c models.HAStateChange
		var attrJSON []byte
		if err := rows.Scan(&c.ID, &c.EntityID, &c.State, &attrJSON, &c.ChangedAt, &c.RecordedAt); err != nil {
			return nil, err
		}
		json.Unmarshal(attrJSON, &c.Attributes)
		changes = append(changes, c)
	}
	return changes, nil
}

// ─── Lease ────────────────────────────────────────────────────────────────────

func (s *Store) GetLeaseAgreement(ctx context.Context) (*models.LeaseAgreement, error) {
	var a models.LeaseAgreement
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, person_name, total_amount, start_date, end_date,
		       expected_monthly, payment_day, notes, created_at
		FROM lease_agreements ORDER BY created_at ASC LIMIT 1`).
		Scan(&a.ID, &a.Name, &a.PersonName, &a.TotalAmount, &a.StartDate, &a.EndDate,
			&a.ExpectedMonthly, &a.PaymentDay, &a.Notes, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *Store) CreateLeaseAgreement(ctx context.Context, a *models.LeaseAgreement) error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	if a.PaymentDay == 0 {
		a.PaymentDay = 15
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO lease_agreements (id, name, person_name, total_amount, start_date, end_date,
		    expected_monthly, payment_day, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		a.ID, a.Name, a.PersonName, a.TotalAmount, a.StartDate, a.EndDate,
		a.ExpectedMonthly, a.PaymentDay, a.Notes)
	return err
}

func (s *Store) ListLeasePayments(ctx context.Context, agreementID string) ([]models.LeasePayment, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, agreement_id, amount_expected, amount_paid, due_date, paid_date,
		       status, notes, created_at
		FROM lease_payments WHERE agreement_id=$1 ORDER BY due_date DESC`, agreementID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.LeasePayment
	for rows.Next() {
		var p models.LeasePayment
		if err := rows.Scan(&p.ID, &p.AgreementID, &p.AmountExpected, &p.AmountPaid,
			&p.DueDate, &p.PaidDate, &p.Status, &p.Notes, &p.CreatedAt); err != nil {
			return nil, err
		}
		payments = append(payments, p)
	}
	return payments, nil
}

func (s *Store) CreateLeasePayment(ctx context.Context, p *models.LeasePayment) error {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO lease_payments (id, agreement_id, amount_expected, amount_paid,
		    due_date, paid_date, status, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		p.ID, p.AgreementID, p.AmountExpected, p.AmountPaid,
		p.DueDate, p.PaidDate, string(p.Status), p.Notes)
	return err
}

func (s *Store) UpdateLeasePayment(ctx context.Context, id string, amountExpected, amountPaid float64, dueDate time.Time, paidDate *time.Time, status models.PaymentStatus, notes string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE lease_payments SET
		    amount_expected=$1, amount_paid=$2, due_date=$3, paid_date=$4,
		    status=$5, notes=$6
		WHERE id=$7`,
		amountExpected, amountPaid, dueDate, paidDate, string(status), notes, id)
	return err
}

// ─── Travel ───────────────────────────────────────────────────────────────────

func (s *Store) GetTravelWatches(ctx context.Context) ([]models.TravelWatch, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, type, label, config, active, created_at
		FROM travel_watches WHERE active = true ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var watches []models.TravelWatch
	for rows.Next() {
		var w models.TravelWatch
		var configJSON []byte
		if err := rows.Scan(&w.ID, &w.Type, &w.Label, &configJSON, &w.Active, &w.CreatedAt); err != nil {
			return nil, err
		}
		json.Unmarshal(configJSON, &w.Config)
		watches = append(watches, w)
	}
	return watches, nil
}

func (s *Store) AddTravelPrice(ctx context.Context, p models.TravelPrice) error {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	detailsJSON, _ := json.Marshal(p.Details)
	_, err := s.pool.Exec(ctx, `
		INSERT INTO travel_prices (id, watch_id, price, currency, details, checked_at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		p.ID, p.WatchID, p.Price, p.Currency, detailsJSON)
	return err
}

func (s *Store) GetPriceHistory(ctx context.Context, watchID string, days int) ([]models.TravelPrice, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, watch_id, price, currency, details, checked_at
		FROM travel_prices
		WHERE watch_id = $1 AND checked_at >= NOW() - make_interval(days => $2)
		ORDER BY checked_at DESC`, watchID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prices []models.TravelPrice
	for rows.Next() {
		var p models.TravelPrice
		var detailsJSON []byte
		if err := rows.Scan(&p.ID, &p.WatchID, &p.Price, &p.Currency, &detailsJSON, &p.CheckedAt); err != nil {
			return nil, err
		}
		json.Unmarshal(detailsJSON, &p.Details)
		prices = append(prices, p)
	}
	return prices, nil
}

func (s *Store) GetLeaseStats(ctx context.Context, agreementID string, totalAmount float64) (*models.LeaseStats, error) {
	var stats models.LeaseStats

	err := s.pool.QueryRow(ctx, `
		SELECT
		    COALESCE(SUM(amount_paid), 0),
		    COUNT(*) FILTER (WHERE status = 'on_time'),
		    COUNT(*) FILTER (WHERE status = 'late'),
		    COUNT(*) FILTER (WHERE status = 'partial'),
		    COUNT(*) FILTER (WHERE status = 'missed')
		FROM lease_payments WHERE agreement_id=$1`, agreementID).
		Scan(&stats.TotalPaid, &stats.CountOnTime, &stats.CountLate,
			&stats.CountPartial, &stats.CountMissed)
	if err != nil {
		return nil, err
	}

	stats.Remaining = totalAmount - stats.TotalPaid
	if totalAmount > 0 {
		stats.ProgressPct = (stats.TotalPaid / totalAmount) * 100
	}

	total := stats.CountOnTime + stats.CountLate + stats.CountPartial + stats.CountMissed
	if total > 0 {
		score := stats.CountOnTime*100 + stats.CountLate*70 + stats.CountPartial*50
		stats.ReliabilityScore = score / total
	}

	return &stats, nil
}

// ─── HA Insights ─────────────────────────────────────────────────────────────

func (s *Store) UpsertHAInsight(ctx context.Context, date, summary string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO ha_insights (date, summary)
		VALUES ($1, $2)
		ON CONFLICT (date) DO UPDATE SET summary = EXCLUDED.summary`,
		date, summary)
	return err
}

func (s *Store) ListHAInsights(ctx context.Context, limit int) ([]models.HAInsight, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, date::text, summary, created_at
		FROM ha_insights ORDER BY date DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var insights []models.HAInsight
	for rows.Next() {
		var i models.HAInsight
		if err := rows.Scan(&i.ID, &i.Date, &i.Summary, &i.CreatedAt); err != nil {
			return nil, err
		}
		insights = append(insights, i)
	}
	return insights, nil
}

// GetHAActivitySummary pulls a condensed view of state changes for a time window,
// grouped by entity category (motion, door, light, climate, lock).
func (s *Store) GetHAActivitySummary(ctx context.Context, from, to time.Time) (map[string][]map[string]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT entity_id, state, changed_at
		FROM ha_state_changes
		WHERE changed_at BETWEEN $1 AND $2
		  AND (
		    entity_id ILIKE '%motion%'   OR
		    entity_id ILIKE '%occupancy%' OR
		    entity_id ILIKE '%door%'     OR
		    entity_id ILIKE '%contact%'  OR
		    entity_id ILIKE '%lock%'     OR
		    entity_id ILIKE '%light%'    OR
		    entity_id ILIKE '%climate%'  OR
		    entity_id ILIKE '%temperature%' OR
		    entity_id ILIKE '%person%'   OR
		    entity_id ILIKE '%presence%'
		  )
		ORDER BY changed_at ASC`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string][]map[string]string{
		"motion":  {},
		"door":    {},
		"lock":    {},
		"light":   {},
		"climate": {},
		"person":  {},
	}

	for rows.Next() {
		var entityID, state string
		var changedAt time.Time
		if err := rows.Scan(&entityID, &state, &changedAt); err != nil {
			return nil, err
		}
		entry := map[string]string{
			"entity":  entityID,
			"state":   state,
			"time":    changedAt.Format("15:04"),
		}
		switch {
		case containsAny(entityID, "motion", "occupancy"):
			result["motion"] = append(result["motion"], entry)
		case containsAny(entityID, "door", "contact"):
			result["door"] = append(result["door"], entry)
		case containsAny(entityID, "lock"):
			result["lock"] = append(result["lock"], entry)
		case containsAny(entityID, "light"):
			result["light"] = append(result["light"], entry)
		case containsAny(entityID, "climate", "temperature"):
			result["climate"] = append(result["climate"], entry)
		case containsAny(entityID, "person", "presence"):
			result["person"] = append(result["person"], entry)
		}
	}
	return result, nil
}

func containsAny(s string, subs ...string) bool {
	sl := strings.ToLower(s)
	for _, sub := range subs {
		if strings.Contains(sl, sub) {
			return true
		}
	}
	return false
}

// ─── Plaid ────────────────────────────────────────────────────────────────────

func (s *Store) UpsertPlaidItem(ctx context.Context, itemID, accessToken, institutionName string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO plaid_items (id, item_id, access_token, institution_name)
		VALUES (gen_random_uuid()::text, $1, $2, $3)
		ON CONFLICT (item_id) DO UPDATE SET access_token=$2, institution_name=$3`,
		itemID, accessToken, institutionName)
	return err
}

func (s *Store) GetPlaidItem(ctx context.Context) (*models.PlaidItem, error) {
	var item models.PlaidItem
	err := s.pool.QueryRow(ctx, `
		SELECT id, item_id, access_token, institution_name, created_at
		FROM plaid_items ORDER BY created_at ASC LIMIT 1`).
		Scan(&item.ID, &item.ItemID, &item.AccessToken, &item.InstitutionName, &item.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Store) BulkUpsertPlaidTransactions(ctx context.Context, txns []models.PlaidTransaction) (int, error) {
	if len(txns) == 0 {
		return 0, nil
	}
	batch := &pgx.Batch{}
	for _, t := range txns {
		batch.Queue(`
			INSERT INTO plaid_transactions
			    (id, item_id, account_id, amount, date, name, merchant_name, category, pending)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			ON CONFLICT (id) DO UPDATE SET
			    amount=EXCLUDED.amount, pending=EXCLUDED.pending`,
			t.ID, t.ItemID, t.AccountID, t.Amount, t.Date,
			t.Name, t.MerchantName, t.Category, t.Pending)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()
	var inserted int
	for range txns {
		if _, err := br.Exec(); err == nil {
			inserted++
		}
	}
	return inserted, nil
}

func (s *Store) GetPlaidTransactions(ctx context.Context, days int) ([]models.PlaidTransaction, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, item_id, account_id, amount, date::text, name, merchant_name, category, pending, created_at
		FROM plaid_transactions
		WHERE date >= NOW() - make_interval(days => $1) AND pending = false
		ORDER BY date DESC`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txns []models.PlaidTransaction
	for rows.Next() {
		var t models.PlaidTransaction
		if err := rows.Scan(&t.ID, &t.ItemID, &t.AccountID, &t.Amount, &t.Date,
			&t.Name, &t.MerchantName, &t.Category, &t.Pending, &t.CreatedAt); err != nil {
			return nil, err
		}
		txns = append(txns, t)
	}
	return txns, nil
}

// ─── Workout Patterns + Insights ─────────────────────────────────────────────

func (s *Store) GetWorkoutPatterns(ctx context.Context) (*models.WorkoutPatterns, error) {
	p := &models.WorkoutPatterns{}

	err := s.pool.QueryRow(ctx, `
		WITH month_days AS (
			SELECT generate_series(
				date_trunc('month', NOW()),
				LEAST(NOW()::date, (date_trunc('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::date),
				'1 day'::interval
			)::date AS d
		),
		workout_days AS (
			SELECT DISTINCT DATE(class_date) AS wd
			FROM workouts
			WHERE class_date >= date_trunc('month', NOW())
		)
		SELECT
			(SELECT COUNT(*) FROM month_days) - (SELECT COUNT(*) FROM workout_days),
			(SELECT COUNT(*) FROM workout_days)
	`).Scan(&p.DaysMissedThisMonth, &p.WorkoutsThisMonth)
	if err != nil {
		return nil, err
	}

	var daysSince float64
	s.pool.QueryRow(ctx, `
		SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(class_date))) / 86400, 999)
		FROM workouts`).Scan(&daysSince)
	p.DaysSinceLastWorkout = int(daysSince)

	s.pool.QueryRow(ctx, `
		SELECT
			COUNT(DISTINCT instructor) FILTER (WHERE instructor != ''),
			COUNT(DISTINCT class_name),
			COALESCE(MODE() WITHIN GROUP (ORDER BY instructor) FILTER (WHERE instructor != ''), ''),
			COALESCE(MODE() WITHIN GROUP (ORDER BY class_name), '')
		FROM workouts
		WHERE class_date >= NOW() - INTERVAL '30 days'
	`).Scan(&p.InstructorVariety, &p.ClassVariety, &p.TopInstructor, &p.TopClass)

	s.pool.QueryRow(ctx, `
		WITH sorted AS (
			SELECT class_date, LAG(class_date) OVER (ORDER BY class_date) AS prev
			FROM workouts
			WHERE class_date >= NOW() - INTERVAL '90 days'
		)
		SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (class_date - prev)) / 86400), 0)
		FROM sorted WHERE prev IS NOT NULL
	`).Scan(&p.AvgDaysBetween)

	{
		wrows, werr := s.pool.Query(ctx, `
			SELECT DISTINCT DATE(class_date) AS wd
			FROM workouts
			WHERE class_date >= NOW() - INTERVAL '60 days'
			ORDER BY wd DESC`)
		if werr == nil {
			defer wrows.Close()
			streak := 0
			var prev time.Time
			for wrows.Next() {
				var d time.Time
				if wrows.Scan(&d) != nil {
					break
				}
				if prev.IsZero() {
					prev = d
					streak = 1
					continue
				}
				diff := prev.Sub(d).Hours() / 24
				if diff <= 1.5 {
					streak++
					prev = d
				} else {
					break
				}
			}
			p.CurrentStreak = streak
		}
	}

	return p, nil
}

func (s *Store) UpsertWorkoutInsight(ctx context.Context, summary string, patterns *models.WorkoutPatterns) (*models.WorkoutInsight, error) {
	pJSON, err := json.Marshal(patterns)
	if err != nil {
		return nil, err
	}
	id := uuid.NewString()
	now := time.Now()
	_, err = s.pool.Exec(ctx, `
		INSERT INTO workout_insights (id, summary, patterns, created_at)
		VALUES ($1, $2, $3, $4)`,
		id, summary, pJSON, now)
	if err != nil {
		return nil, err
	}
	return &models.WorkoutInsight{
		ID:        id,
		Summary:   summary,
		Patterns:  *patterns,
		CreatedAt: now,
	}, nil
}

func (s *Store) GetLatestWorkoutInsight(ctx context.Context) (*models.WorkoutInsight, error) {
	var wi models.WorkoutInsight
	var pJSON []byte
	err := s.pool.QueryRow(ctx, `
		SELECT id, summary, patterns, created_at
		FROM workout_insights
		ORDER BY created_at DESC
		LIMIT 1`).Scan(&wi.ID, &wi.Summary, &pJSON, &wi.CreatedAt)
	if err != nil {
		return nil, err
	}
	json.Unmarshal(pJSON, &wi.Patterns)
	return &wi, nil
}
