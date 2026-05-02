package main

import (
	"fmt"
	"os"
	"strings"
)

func main() {
	content, _ := os.ReadFile("internal/integrations/httpreq/httpreq.go")
	newContent := strings.Replace(string(content), 
		"if json.Unmarshal(respBody, &parsed) == nil {", 
		"errMap := json.Unmarshal(respBody, &parsed)\n\tfmt.Printf(\"httpreq JSON UNMARSHAL MAP ERR: %v\\n\", errMap)\n\tif errMap == nil {", 1)
	newContent = strings.Replace(newContent, 
		"if json.Unmarshal(respBody, &parsedArr) == nil {", 
		"errArr := json.Unmarshal(respBody, &parsedArr)\n\t\tfmt.Printf(\"httpreq JSON UNMARSHAL ARR ERR: %v\\n\", errArr)\n\t\tif errArr == nil {", 1)
	os.WriteFile("internal/integrations/httpreq/httpreq.go", []byte(newContent), 0644)
}
