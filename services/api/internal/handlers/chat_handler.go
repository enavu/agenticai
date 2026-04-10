package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"enavu-hub/api/internal/agent"
	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/store"
	inws "enavu-hub/api/internal/ws"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:    func(r *http.Request) bool { return true }, // Allow all origins in dev
}

type ChatHandler struct {
	hub     *inws.Hub
	haAgent *agent.HAAgent
	store   *store.Store
}

func NewChatHandler(hub *inws.Hub, haAgent *agent.HAAgent, s *store.Store) *ChatHandler {
	return &ChatHandler{hub: hub, haAgent: haAgent, store: s}
}

type wsMessage struct {
	Type           string `json:"type"`
	Content        string `json:"content"`
	ConversationID string `json:"conversation_id,omitempty"`
	AgentRunID     string `json:"agent_run_id,omitempty"`
	StepIndex      int    `json:"step_index,omitempty"`
	StepType       string `json:"step_type,omitempty"`
}

func (h *ChatHandler) Handle(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := inws.NewClient(h.hub, conn)
	h.hub.Register(client)

	// Create a new conversation
	conv, err := h.store.CreateConversation(c.Request.Context())
	if err != nil {
		log.Printf("Create conversation failed: %v", err)
	}

	// Send conversation ID to client
	hello, _ := json.Marshal(wsMessage{
		Type:           "connected",
		ConversationID: conv.ID,
		Content:        "Connected to HA agent. How can I help with your home?",
	})
	client.Send(hello)

	client.OnMessage = func(msg []byte) {
		var incoming wsMessage
		if err := json.Unmarshal(msg, &incoming); err != nil {
			return
		}
		if incoming.Type != "message" || incoming.Content == "" {
			return
		}

		// Persist user message
		userMsg := &models.Message{
			ConversationID: conv.ID,
			Role:           models.MessageRoleUser,
			Content:        incoming.Content,
		}
		h.store.AddMessage(c.Request.Context(), userMsg)

		// Send "thinking" acknowledgement
		ack, _ := json.Marshal(wsMessage{
			Type:    "thinking",
			Content: "Running agent...",
		})
		client.Send(ack)

		// Run HA agent with step callback to stream progress
		run, err := h.haAgent.Run(c.Request.Context(), incoming.Content, func(run *models.AgentRun) {
			if len(run.Steps) == 0 {
				return
			}
			lastStep := run.Steps[len(run.Steps)-1]
			stepMsg, _ := json.Marshal(wsMessage{
				Type:       "step",
				AgentRunID: run.ID,
				StepIndex:  lastStep.Index,
				StepType:   lastStep.Type,
				Content:    lastStep.Content,
			})
			client.Send(stepMsg)
		})

		// Build final response
		var finalContent string
		if err != nil {
			finalContent = "Sorry, I encountered an error: " + err.Error()
		} else if run.Output != nil {
			finalContent = *run.Output
		} else {
			finalContent = "Done."
		}

		// Persist assistant message
		agentRunID := ""
		if run != nil {
			agentRunID = run.ID
		}
		assistantMsg := &models.Message{
			ConversationID: conv.ID,
			Role:           models.MessageRoleAssistant,
			Content:        finalContent,
			AgentRunID:     &agentRunID,
		}
		h.store.AddMessage(c.Request.Context(), assistantMsg)

		finalMsg, _ := json.Marshal(wsMessage{
			Type:       "message",
			Content:    finalContent,
			AgentRunID: agentRunID,
		})
		client.Send(finalMsg)
	}

	go client.WritePump()
	client.ReadPump()
}
