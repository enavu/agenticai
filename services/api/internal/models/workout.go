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
	LastWorkout    time.Time `json:"last_workout"`
	WorkoutsThisMonth int   `json:"workouts_this_month"`
}
