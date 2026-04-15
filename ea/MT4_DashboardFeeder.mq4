//+------------------------------------------------------------------+
//|                                             DashboardFeeder.mq4   |
//|                                     Sends Live Ticks to Express   |
//+------------------------------------------------------------------+
#property strict
#property description "Sends live price quotes to NodeJS Dashboard via Webhook"

input string WebhookUrl = "http://localhost:4000/api/webhooks/mt-feed";
input int UpdateIntervalMs = 500; // Throttle ticks

int lastUpdate = 0;

int OnInit() {
   Print("Dashboard Feeder Started -> ", WebhookUrl);
   EventSetMillisecondTimer(500);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   EventKillTimer();
   Print("Dashboard Feeder Stopped.");
}

void OnTick() {
   int now = GetTickCount();
   if (now - lastUpdate < UpdateIntervalMs) return; // limit frequency to protect Node.js
   lastUpdate = now;
   
   string symbol = Symbol();
   double ask = MarketInfo(symbol, MODE_ASK);
   double bid = MarketInfo(symbol, MODE_BID);
   double mid_price = (ask + bid) / 2.0;
   
   // Create JSON Payload
   string payload = StringFormat("{\"symbol\":\"%s\", \"price\":%f}", symbol, mid_price);
   
   // WebRequest variables
   char postData[];
   char result[];
   string resultHeaders;
   StringToCharArray(payload, postData, 0, StringLen(payload));
   
   int res = WebRequest("POST", WebhookUrl, "Content-Type: application/json\r\n", 1000, postData, result, resultHeaders);
   if (res == -1) {
      Print("Error sending tick: ", GetLastError(), ". Did you check 'Allow WebRequest' in Tools->Options?");
   }
}
