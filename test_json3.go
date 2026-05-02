package main

import (
	"encoding/json"
	"fmt"
)

func main() {
	bodyStr := "{\"id\":\"btc-bitcoin\",\"name\":\"Bitcoin\",\"symbol\":\"BTC\",\"rank\":1,\"total_supply\":20023716,\"max_supply\":21000000,\"beta_value\":0.93385,\"first_data_at\":\"2010-07-17T00:00:00Z\",\"last_updated\":\"2026-05-02T15:58:15Z\",\"quotes\":{\"USD\":{\"price\":78473.8217813775,\"volume_24h\":17976062032.80381,\"volume_24h_change_24h\":-38.349998474121094,\"market_cap\":1571337520784,\"market_cap_change_24h\":0.23999999463558197,\"percent_change_15m\":0.05999999865889549,\"percent_change_30m\":0.12999999523162842,\"percent_change_1h\":0.019999999552965164,\"percent_change_6h\":0.2199999988079071,\"percent_change_12h\":0.23999999463558197,\"percent_change_24h\":0.23999999463558197,\"percent_change_7d\":1.3200000524520874,\"percent_change_30d\":0,\"percent_change_1y\":0,\"ath_price\":126173.1777846797,\"ath_date\":\"2025-10-06T19:00:40Z\",\"percent_from_price_ath\":-37.85}}}\n"
	
	var parsed map[string]any
	err := json.Unmarshal([]byte(bodyStr), &parsed)
	if err != nil {
		fmt.Println("Unmarshal failed:", err)
	} else {
		fmt.Println("Unmarshal SUCCESS! Type:", fmt.Sprintf("%T", parsed))
	}
}
