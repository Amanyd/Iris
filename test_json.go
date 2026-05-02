package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	resp, err := http.Get("https://api.coinpaprika.com/v1/tickers/btc-bitcoin")
	if err != nil {
		fmt.Println("GET err:", err)
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	var parsed map[string]any
	err = json.Unmarshal(respBody, &parsed)
	if err != nil {
		fmt.Println("Unmarshal err:", err)
	} else {
		fmt.Println("Unmarshal SUCCESS!")
	}
}
