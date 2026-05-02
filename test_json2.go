package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, _ := http.NewRequest("GET", "https://api.coinpaprika.com/v1/tickers/btc-bitcoin", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("GET err:", err)
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var parsed map[string]any
	err = json.Unmarshal(respBody, &parsed)
	if err != nil {
		fmt.Println("Unmarshal map err:", err)
	} else {
		fmt.Println("Unmarshal map SUCCESS!")
	}
}
