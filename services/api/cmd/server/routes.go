package main

import (
	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/handlers"
	"enavu-hub/api/internal/middleware"
)

func setupRoutes(
	r *gin.Engine,
	health  *handlers.HealthHandler,
	workout *handlers.WorkoutHandler,
	home    *handlers.HomeHandler,
	post    *handlers.PostHandler,
	agentH  *handlers.AgentHandler,
	chat    *handlers.ChatHandler,
) {
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())

	r.GET("/health", health.Health)

	// WebSocket — must be outside /api/v1 to avoid auth middleware
	r.GET("/ws/chat", chat.Handle)

	v1 := r.Group("/api/v1")
	{
		v1.GET("/workouts", workout.List)
		v1.POST("/workouts/sync", workout.Sync)

		v1.GET("/home/state", home.State)
		v1.GET("/home/lights", home.Lights)

		v1.GET("/posts", post.List)
		v1.POST("/posts/generate", post.Generate)

		v1.GET("/agents/runs", agentH.ListRuns)
		v1.GET("/agents/runs/:id", agentH.GetRun)
	}
}
