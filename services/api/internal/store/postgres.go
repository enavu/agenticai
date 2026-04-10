package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

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

CREATE TABLE IF NOT EXISTS ha_snapshots (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    state_json JSONB NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
		    COUNT(*)::int,
		    COALESCE(SUM(cals_burned), 0)::int,
		    COALESCE(SUM(duration_minutes), 0)::int,
		    COALESCE(AVG(cals_burned), 0)::float,
		    COALESCE(MAX(class_date), NOW()),
		    COUNT(*) FILTER (WHERE class_date >= date_trunc('month', NOW()))::int
		FROM workouts`).Scan(&stats.TotalWorkouts, &stats.TotalCalories,
		&stats.TotalMinutes, &stats.AvgCalories, &stats.LastWorkout,
		&stats.WorkoutsThisMonth)
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
