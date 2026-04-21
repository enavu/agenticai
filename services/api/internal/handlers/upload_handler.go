package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var allowedExts = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
}

type UploadHandler struct {
	uploadDir string
	siteURL   string
}

func NewUploadHandler(uploadDir, siteURL string) *UploadHandler {
	os.MkdirAll(uploadDir, 0755)
	return &UploadHandler{uploadDir: uploadDir, siteURL: siteURL}
}

func (h *UploadHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}

	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}

	filename := uuid.New().String() + ext
	dst := filepath.Join(h.uploadDir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	url := fmt.Sprintf("%s/api/v1/files/%s", h.siteURL, filename)
	c.JSON(http.StatusOK, gin.H{"url": url})
}
