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
	
	fmt.Printf("respBody length: %d\n", len(respBody))
	fmt.Printf("respBody start: %q\n", string(respBody[:20]))

	var parsed map[string]any
	err1 := json.Unmarshal(respBody, &parsed)
	
	var parsedArr []any
	err2 := json.Unmarshal(respBody, &parsedArr)

	fmt.Printf("Unmarshal map err: %v\n", err1)
	fmt.Printf("Unmarshal arr err: %v\n", err2)
}
