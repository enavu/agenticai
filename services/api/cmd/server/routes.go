package main

import (
	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/handlers"
	"enavu-hub/api/internal/middleware"
)

func setupRoutes(
	r *gin.Engine,
	jwtSecret string,
	auth    *handlers.AuthHandler,
	health  *handlers.HealthHandler,
	workout *handlers.WorkoutHandler,
	home    *handlers.HomeHandler,
	post    *handlers.PostHandler,
	agentH  *handlers.AgentHandler,
	chat    *handlers.ChatHandler,
	upload  *handlers.UploadHandler,
	finance *handlers.FinanceHandler,
	uploadDir string,
) {
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())

	// ─── Public ──────────────────────────────────────────────────────────────
	r.GET("/health", health.Health)

	r.POST("/auth/login", auth.Login)
	r.POST("/auth/logout", auth.Logout)
	r.GET("/auth/me", auth.Me)

	// Serve uploaded images publicly (Instagram needs to fetch them)
	r.Static("/api/v1/files", uploadDir)

	v1 := r.Group("/api/v1")
	{
		// Read-only — public
		v1.GET("/workouts", workout.List)
		v1.GET("/home/state", home.State)
		v1.GET("/home/lights", home.Lights)
		v1.GET("/posts", post.List)
		v1.GET("/agents/runs", agentH.ListRuns)
		v1.GET("/agents/runs/:id", agentH.GetRun)
	}

	// ─── Protected — requires login ───────────────────────────────────────────
	requireAuth := middleware.RequireAuth(jwtSecret)

	// WebSocket — auth checked inside handler via cookie (browsers send cookies automatically)
	r.GET("/ws/chat", requireAuth, chat.Handle)

	priv := r.Group("/api/v1", requireAuth)
	{
		priv.POST("/workouts/sync", workout.Sync)
		priv.POST("/posts/generate", post.Generate)
		priv.POST("/uploads", upload.Upload)

		priv.GET("/finance", finance.Get)
		priv.POST("/finance/setup", finance.Setup)
		priv.POST("/finance/payments", finance.LogPayment)
		priv.PUT("/finance/payments/:id", finance.UpdatePayment)
	}
}
