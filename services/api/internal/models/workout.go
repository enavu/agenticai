package models

import "time"

type Workout struct {
	ID          string    `json:"id" db:"id"`
	ClassDate   time.Time `json:"class_date" db:"class_date"`
	ClassName   string    `json:"class_name" db:"class_name"`
	Instructor  string    `json:"instructor" db:"instructor"`
	Studio      string    `json:"studio" db:"studio"`
	Duration    int       `json:"duration_minutes" db:"duration_minutes"`
	CalsBurned  *int      `json:"cals_burned,omitempty" db:"cals_burned"`
	AvgOutput   *int      `json:"avg_output,omitempty" db:"avg_output"`
	TotalOutput *int      `json:"total_output,omitempty" db:"total_output"`
	Rank        *string   `json:"rank,omitempty" db:"rank"`
	RawData     []byte    `json:"raw_data,omitempty" db:"raw_data"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type WorkoutStats struct {
	TotalWorkouts  int       `json:"total_workouts"`
	TotalCalories  int       `json:"total_calories"`
	TotalMinutes   int       `json:"total_minutes"`
	AvgCalories    float64   `json:"avg_calories"`
	FirstWorkout      time.Time `json:"first_workout"`
	LastWorkout       time.Time `json:"last_workout"`
	WorkoutsThisMonth int       `json:"workouts_this_month"`
}

type WorkoutPatterns struct {
	DaysMissedThisMonth int     `json:"days_missed_this_month"`
	WorkoutsThisMonth   int     `json:"workouts_this_month"`
	CurrentStreak       int     `json:"current_streak"`
	DaysSinceLastWorkout int    `json:"days_since_last_workout"`
	InstructorVariety   int     `json:"instructor_variety_30d"`
	ClassVariety        int     `json:"class_variety_30d"`
	TopInstructor       string  `json:"top_instructor"`
	TopClass            string  `json:"top_class"`
	AvgDaysBetween      float64 `json:"avg_days_between_workouts"`
}

type WorkoutInsight struct {
	ID        string    `json:"id"`
	Summary   string    `json:"summary"`
	Patterns  WorkoutPatterns `json:"patterns"`
	CreatedAt time.Time `json:"created_at"`
}
