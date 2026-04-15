$url = "http://localhost:4000/api/webhooks/mt-feed"
$headers = @{"Content-Type" = "application/json"}

Write-Host "Shooting test data to backend..."
for ($i = 0; $i -lt 20; $i++) {
    $prices = @()
    $prices += @{ symbol = "EURUSD"; price = 1.1000 + ($i * 0.0005) }
    $prices += @{ symbol = "GBPUSD"; price = 1.2500 + ($i * 0.0005) }
    $prices += @{ symbol = "XAUUSD"; price = 1900.00 + ($i * 0.5) }
    $prices += @{ symbol = "USDJPY"; price = 150.00 - ($i * 0.05) }
    $prices += @{ symbol = "AUDUSD"; price = 0.6500 + ($i * 0.0002) }
    $prices += @{ symbol = "USDCHF"; price = 0.8800 - ($i * 0.0004) }
    $prices += @{ symbol = "USDCAD"; price = 1.3600 - ($i * 0.0003) }
    $prices += @{ symbol = "NZDUSD"; price = 0.6100 + ($i * 0.0002) }
    
    $body = @{ prices = $prices } | ConvertTo-Json -Depth 10
    
    try {
        Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body | Out-Null
        Write-Host "Sent tick $i"
    } catch {
        Write-Host "Failed to send tick $i"
    }
    Start-Sleep -Seconds 1
}
Write-Host "Done!"
