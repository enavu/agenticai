package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var refossChannelNames = map[int]string{
	1:  "Main Line A",
	2:  "Top Floor Furnace",
	3:  "Hall / Laundry / Stairs / Bath 2",
	4:  "Master Bed / Closet / Porch",
	5:  "Bed 3",
	6:  "Entry / Wet Bar / Dining Lts",
	7:  "Main Line B",
	8:  "Crawlspace Furnace",
	9:  "House GFCI",
	10: "Master Bath / Outlet West",
	11: "Bath / Stairs / Hall / Living Lts",
	12: "Smokes / Bed 2",
	13: "Kitchen Lts",
	14: "Living Room",
	15: "Dishwasher / Disposal",
	16: "Dining / Wet Bar",
	17: "Kit GFCI 1",
	18: "Wet Bar / Top Floor",
}

type EnergyChannel struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	IsMains     bool      `json:"is_mains"`
	PowerW      float64   `json:"power_w"`
	CurrentA    float64   `json:"current_a"`
	VoltageV    float64   `json:"voltage_v"`
	PowerFactor float64   `json:"power_factor"`
	TodayKwh    float64   `json:"today_kwh"`
	WeekKwh     float64   `json:"week_kwh"`
	MonthKwh    float64   `json:"month_kwh"`
	LastUpdated time.Time `json:"last_updated"`
}

type EnergySummary struct {
	TotalPowerW       float64    `json:"total_power_w"`
	TodayKwh          float64    `json:"today_kwh"`
	WeekKwh           float64    `json:"week_kwh"`
	MonthKwh          float64    `json:"month_kwh"`
	DailyAvgKwh       float64    `json:"daily_avg_kwh"`
	ProjectedMonthKwh float64    `json:"projected_month_kwh"`
	ProjectedCostUsd  float64    `json:"projected_cost_usd"`
	DayOfMonth        int        `json:"day_of_month"`
	OnlineSince       *time.Time `json:"online_since,omitempty"`
	DaysOfData        int        `json:"days_of_data"`
	FetchedAt         time.Time  `json:"fetched_at"`
}

func (h *HomeHandler) Energy(c *gin.Context) {
	states, err := h.ha.GetAllStates(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	const prefix = "sensor.refoss_smart_energy_monitor_em_channel_"
	knownTypes := []string{
		"this_month_energy", "this_week_energy", "today_energy",
		"power_factor", "current", "voltage", "power",
	}

	channelMap := make(map[int]*EnergyChannel, 18)
	for i := 1; i <= 18; i++ {
		channelMap[i] = &EnergyChannel{
			ID:      i,
			Name:    refossChannelNames[i],
			IsMains: i == 1 || i == 7,
		}
	}

	for _, s := range states {
		if !strings.HasPrefix(s.EntityID, prefix) {
			continue
		}
		rest := strings.TrimPrefix(s.EntityID, prefix)
		val, err := strconv.ParseFloat(s.State, 64)
		if err != nil {
			continue
		}
		for _, t := range knownTypes {
			if !strings.HasSuffix(rest, "_"+t) {
				continue
			}
			chStr := strings.TrimSuffix(rest, "_"+t)
			ch, err := strconv.Atoi(chStr)
			if err != nil || ch < 1 || ch > 18 {
				break
			}
			data := channelMap[ch]
			switch t {
			case "power":
				data.PowerW = val
				data.LastUpdated = s.LastUpdated
			case "current":
				data.CurrentA = val
			case "voltage":
				data.VoltageV = val
			case "power_factor":
				data.PowerFactor = val
			case "today_energy":
				data.TodayKwh = val
			case "this_week_energy":
				data.WeekKwh = val
			case "this_month_energy":
				data.MonthKwh = val
			}
			break
		}
	}

	channels := make([]*EnergyChannel, 0, 18)
	for i := 1; i <= 18; i++ {
		channels = append(channels, channelMap[i])
	}

	// Find online-since via CH1 power history (30 days back)
	var onlineSince *time.Time
	history, err := h.ha.GetHistory(c.Request.Context(),
		"sensor.refoss_smart_energy_monitor_em_channel_1_power", 720)
	if err == nil && len(history) > 0 && len(history[0]) > 0 {
		t := history[0][0].LastChanged
		onlineSince = &t
	}

	now := time.Now()
	dayOfMonth := now.Day()
	monthKwh := channelMap[1].MonthKwh + channelMap[7].MonthKwh
	todayKwh := channelMap[1].TodayKwh + channelMap[7].TodayKwh
	weekKwh := channelMap[1].WeekKwh + channelMap[7].WeekKwh

	daysOfData := dayOfMonth
	if onlineSince != nil {
		daysSince := int(now.Sub(*onlineSince).Hours()/24) + 1
		if daysSince < daysOfData {
			daysOfData = daysSince
		}
	}

	var dailyAvg float64
	if daysOfData > 0 {
		dailyAvg = monthKwh / float64(daysOfData)
	}
	projected := dailyAvg * 30

	summary := EnergySummary{
		TotalPowerW:       channelMap[1].PowerW + channelMap[7].PowerW,
		TodayKwh:          todayKwh,
		WeekKwh:           weekKwh,
		MonthKwh:          monthKwh,
		DailyAvgKwh:       dailyAvg,
		ProjectedMonthKwh: projected,
		ProjectedCostUsd:  projected * 0.12,
		DayOfMonth:        dayOfMonth,
		OnlineSince:       onlineSince,
		DaysOfData:        daysOfData,
		FetchedAt:         now,
	}

	c.JSON(http.StatusOK, gin.H{"channels": channels, "summary": summary})
}
