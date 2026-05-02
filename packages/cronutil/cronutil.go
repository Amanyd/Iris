package cronutil

import (
	"fmt"
	"time"

	"github.com/robfig/cron/v3"
)

// NextRun returns the next time the cron expression fires after `from`.
func NextRun(expr string, from time.Time) (time.Time, error) {
	schedule, err := parse(expr)
	if err != nil {
		return time.Time{}, err
	}
	return schedule.Next(from), nil
}

// IsValid reports whether expr is a valid standard cron expression.
func IsValid(expr string) bool {
	_, err := parse(expr)
	return err == nil
}

// parse creates a cron.Schedule from a 5-field standard cron expression.
// Accepts standard 5-field format: "min hour dom month dow"
// e.g. "0 9 * * 1-5" = 9am on weekdays.
func parse(expr string) (cron.Schedule, error) {
	p := cron.NewParser(
		cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow,
	)
	schedule, err := p.Parse(expr)
	if err != nil {
		return nil, fmt.Errorf("cronutil: invalid cron expression %q: %w", expr, err)
	}
	return schedule, nil
}
