package handlers

import (
	"crypto/subtle"
	"net/http"

	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/config"
	"enavu-hub/api/internal/middleware"
)

type AuthHandler struct {
	cfg *config.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	emailOK := subtle.ConstantTimeCompare([]byte(body.Email), []byte(h.cfg.AdminEmail)) == 1
	passOK := subtle.ConstantTimeCompare([]byte(body.Password), []byte(h.cfg.AdminPassword)) == 1
	if !emailOK || !passOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token := middleware.CreateToken(body.Email, h.cfg.JWTSecret)
	maxAge := 30 * 24 * 60 * 60 // 30 days
	secure := h.cfg.IsProd()
	c.SetCookie(middleware.SessionCookie, token, maxAge, "/", "", secure, true)
	// Non-HttpOnly flag cookie so JS can detect auth state
	c.SetCookie("enavu_authed", "1", maxAge, "/", "", secure, false)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	c.SetCookie(middleware.SessionCookie, "", -1, "/", "", false, true)
	c.SetCookie("enavu_authed", "", -1, "/", "", false, false)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *AuthHandler) Me(c *gin.Context) {
	token, err := c.Cookie(middleware.SessionCookie)
	if err != nil || !middleware.ValidateToken(token, h.cfg.JWTSecret) {
		c.JSON(http.StatusOK, gin.H{"authenticated": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"authenticated": true})
}
