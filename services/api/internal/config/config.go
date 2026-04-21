package config

import (
	"os"
	"strconv"
)

type Config struct {
	Env           string
	Port          string
	DatabaseURL   string
	RedisURL      string
	HA            HAConfig
	Anthropic     AnthropicConfig
	Instagram     InstagramConfig
	ScraperURL    string
	JWTSecret     string
	AdminEmail    string
	AdminPassword string
	SiteURL       string
	UploadDir     string
}

type HAConfig struct {
	URL   string
	Token string
}

type AnthropicConfig struct {
	APIKey string
	Model  string
}

type InstagramConfig struct {
	AccessToken string
	UserID      string
}

func Load() *Config {
	return &Config{
		Env:         getEnv("ENV", "development"),
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://enavu:enavu@localhost:5432/enavu_hub?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		HA: HAConfig{
			URL:   getEnv("HA_URL", "http://hotel89408.com:8123"),
			Token: getEnv("HA_TOKEN", ""),
		},
		Anthropic: AnthropicConfig{
			APIKey: getEnv("ANTHROPIC_API_KEY", ""),
			Model:  getEnv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
		},
		Instagram: InstagramConfig{
			AccessToken: getEnv("INSTAGRAM_ACCESS_TOKEN", ""),
			UserID:      getEnv("INSTAGRAM_USER_ID", ""),
		},
		ScraperURL:    getEnv("SCRAPER_URL", "http://localhost:8001"),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret"),
		AdminEmail:    getEnv("ADMIN_EMAIL", ""),
		AdminPassword: getEnv("ADMIN_PASSWORD", ""),
		SiteURL:       getEnv("SITE_URL", "http://localhost:8080"),
		UploadDir:     getEnv("UPLOAD_DIR", "/data/uploads"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func (c *Config) IsProd() bool {
	return c.Env == "production"
}
