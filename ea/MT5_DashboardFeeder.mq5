#include <Trade\Trade.mqh>

#import "kernel32.dll"
long CreateFileW(string lpFileName, uint dwDesiredAccess, uint dwShareMode, ulong lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, long hTemplateFile);
int  WriteFile(long hFile, const uchar &lpBuffer[], uint nNumberOfBytesToWrite, uint &lpNumberOfBytesWritten, ulong lpOverlapped);
int  ReadFile(long hFile, uchar &lpBuffer[], uint nNumberOfBytesToRead, uint &lpNumberOfBytesRead, ulong lpOverlapped);
int  PeekNamedPipe(long hPipe, uchar &lpBuffer[], uint nBufferSize, uint &lpBytesRead, uint &lpTotalBytesAvail, uint &lpBytesLeftThisMessage);
int  CloseHandle(long hObject);
#import

input string PipeName       = "\\\\.\\pipe\\mql5_dashboard_feed";
input string CmdPipeName    = "\\\\.\\pipe\\mql5_dashboard_trades";
input string ConfirmPipeName = "\\\\.\\pipe\\mql5_dashboard_confirm"; // ส่ง confirmation กลับ
input int    UpdateIntervalMs = 900000; // 15 นาที (15 × 60 × 1000)
input int    HistoricalBars   = 96;     // จำนวน M15 bars ย้อนหลังที่ส่งตอน startup

CTrade trade;
long hCmdPipe     = -1;
long hConfirmPipe = -1;
uint lastUpdate   = 0;

// Symbols ที่ติดตาม (ตัด XAUUSD ออก สำหรับ Pocket Mode)
string symbols[] = {"EURUSD","GBPUSD","USDJPY","AUDUSD","USDCHF","NZDUSD"};

int OnInit() {
   Print("Dashboard Feeder Started | Feed: ", PipeName);
   Print("Command Pipe: ", CmdPipeName);
   Print("Confirm Pipe: ", ConfirmPipeName);

   // 1. เชื่อมต่อ command pipe
   hCmdPipe = CreateFileW(CmdPipeName, 0x80000000, 0, 0, 3, 0, 0);
   if(hCmdPipe == -1)
      Print("Warning: Command Pipe not ready yet (backend อาจยังไม่ start)");

   // 2. เชื่อมต่อ confirm pipe
   hConfirmPipe = CreateFileW(ConfirmPipeName, 0x40000000, 0, 0, 3, 0, 0);
   if(hConfirmPipe == -1)
      Print("Warning: Confirm Pipe not ready yet");

   // 3. ส่ง historical bars ทันที → แก้ปัญหา warm-up 24 ชั่วโมง
   EventSetTimer(1);
   SendHistoricalBars();

   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   Print("Dashboard Feeder Stopped.");
   if(hCmdPipe != -1)     CloseHandle(hCmdPipe);
   if(hConfirmPipe != -1) CloseHandle(hConfirmPipe);
   EventKillTimer();
}

//──────────────────────────────────────────────────────────────────────────────
// ส่งข้อมูลย้อนหลัง 96 แท่ง M15 ตอน startup
// Backend ingest ผ่าน POST /api/price/backfill → signal พร้อมทำงานทันที
//──────────────────────────────────────────────────────────────────────────────
void SendHistoricalBarsForSymbol(string symBase, string sym) {
   // ส่ง HTTP POST ไปยัง backend backfill endpoint
   // เนื่องจาก MQL5 ไม่มี built-in HTTP POST ง่ายๆ จึงใช้ pipe feed แทน
   // ส่งราคาย้อนหลัง oldest→newest ผ่าน feed pipe ปกติ
   string payload = "{\"prices\":[";
   bool first = true;
   for(int i = HistoricalBars - 1; i >= 1; i--) {
      double closePrice = iClose(sym, PERIOD_M15, i);
      if(closePrice <= 0) continue;
      long   barTime    = (long)iTime(sym, PERIOD_M15, i) * 1000; // unix ms
      if(!first) payload += ",";
      payload += StringFormat("{\"symbol\":\"%s\",\"price\":%.5f,\"ts\":%lld}",
                              symBase, closePrice, barTime);
      first = false;
   }
   payload += "]}";
   WriteToPipe(payload);
}

void SendHistoricalBars() {
   Print("Sending ", HistoricalBars, " historical M15 bars per symbol...");
   for(int s = 0; s < ArraySize(symbols); s++) {
      string sym = GetActualSymbol(symbols[s]);
      if(sym == "") continue;
      SendHistoricalBarsForSymbol(symbols[s], sym);
      Sleep(50); // หน่วงเล็กน้อยเพื่อไม่ให้ pipe overload
   }
   Print("Historical data sent. System should be ready for signals.");
}

//──────────────────────────────────────────────────────────────────────────────
// ตรวจสอบ command pipe และ execute trade
//──────────────────────────────────────────────────────────────────────────────
void OnTimer() {
   // retry connect ถ้า pipe ยังไม่ได้เชื่อม
   if(hCmdPipe == -1)
      hCmdPipe = CreateFileW(CmdPipeName, 0x80000000, 0, 0, 3, 0, 0);
   if(hConfirmPipe == -1)
      hConfirmPipe = CreateFileW(ConfirmPipeName, 0x40000000, 0, 0, 3, 0, 0);
   if(hCmdPipe == -1) return;

   uint avail = 0, read = 0, left = 0;
   uchar dummy[1];
   if(PeekNamedPipe(hCmdPipe, dummy, 0, read, avail, left) != 0 && avail > 0) {
      uchar buffer[4096];
      uint bytesRead = 0;
      if(ReadFile(hCmdPipe, buffer, 4096, bytesRead, 0) != 0 && bytesRead > 0) {
         string raw = CharArrayToString(buffer, 0, bytesRead, CP_UTF8);

         string lines[];
         int n = StringSplit(raw, '\n', lines);
         if(n == 0) { n = 1; ArrayResize(lines, 1); lines[0] = raw; }

         for(int i = 0; i < n; i++) {
            string cmdLine = lines[i];
            if(StringLen(cmdLine) < 5) continue;
            ProcessCommand(cmdLine);
         }
      }
   }
}

void ProcessCommand(string cmdLine) {
   string symBase = ExtractValue(cmdLine, "\"symbol\":\"");
   string sym     = GetActualSymbol(symBase);
   string tradeId = ExtractValue(cmdLine, "\"id\":\"");
   double vol     = StringToDouble(ExtractValue(cmdLine, "\"volume\":"));

   // fallback: ถ้า symbol หาไม่เจอ skip
   if(sym == "" && StringFind(cmdLine, "\"cmd\":\"close\"") < 0) {
      Print("Error: Symbol not found for: ", symBase);
      return;
   }

   if(StringFind(cmdLine, "\"cmd\":\"buy\"") >= 0) {
      if(vol <= 0) vol = 0.01; // safety fallback
      Print("BUY ", sym, " vol=", vol, " id=", tradeId);
      bool ok = trade.Buy(vol, sym);
      SendConfirmation(tradeId, trade.ResultRetcode(), trade.ResultComment());
      if(!ok) Print("BUY FAILED: ", sym, " code=", trade.ResultRetcode());

   } else if(StringFind(cmdLine, "\"cmd\":\"sell\"") >= 0) {
      if(vol <= 0) vol = 0.01;
      Print("SELL ", sym, " vol=", vol, " id=", tradeId);
      bool ok = trade.Sell(vol, sym);
      SendConfirmation(tradeId, trade.ResultRetcode(), trade.ResultComment());
      if(!ok) Print("SELL FAILED: ", sym, " code=", trade.ResultRetcode());

   } else if(StringFind(cmdLine, "\"cmd\":\"close\"") >= 0) {
      Print("CLOSE all positions for ", sym);
      int closedCount = 0;
      for(int k = PositionsTotal() - 1; k >= 0; k--) {
         ulong ticket = PositionGetTicket(k);
         if(!PositionSelectByTicket(ticket)) continue;
         if(PositionGetString(POSITION_SYMBOL) != sym) continue;
         if(trade.PositionClose(ticket)) {
            closedCount++;
            SendConfirmation(tradeId, trade.ResultRetcode(), trade.ResultComment());
         } else {
            Print("CLOSE FAILED ticket=", ticket, " code=", trade.ResultRetcode());
         }
      }
      Print("Closed ", closedCount, " positions for ", sym);
   }
}

// ส่ง confirmation กลับไปหา backend ผ่าน confirm pipe
void SendConfirmation(string tradeId, uint retcode, string comment) {
   if(hConfirmPipe == -1) return;
   // escape double-quotes ใน comment
   StringReplace(comment, "\"", "'");
   string payload = StringFormat(
      "{\"id\":\"%s\",\"retcode\":%u,\"comment\":\"%s\"}\n",
      tradeId, retcode, comment
   );
   uchar buf[];
   StringToCharArray(payload, buf, 0, WHOLE_ARRAY, CP_UTF8);
   uint written = 0;
   WriteFile(hConfirmPipe, buf, ArraySize(buf) - 1, written, 0);
}

//──────────────────────────────────────────────────────────────────────────────
// OnTick — ส่งราคาปัจจุบันทุก 15 นาที
//──────────────────────────────────────────────────────────────────────────────
void OnTick() {
   uint now = GetTickCount();
   if(now - lastUpdate < (uint)UpdateIntervalMs) return;
   lastUpdate = now;

   string payload = "{\"prices\":[";
   bool first = true;

   for(int i = 0; i < ArraySize(symbols); i++) {
      string symBase = symbols[i];
      string sym     = GetActualSymbol(symBase);
      if(sym == "") continue;

      double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
      double bid = SymbolInfoDouble(sym, SYMBOL_BID);
      if(ask > 0 && bid > 0) {
         double mid = (ask + bid) / 2.0;
         if(!first) payload += ",";
         payload += StringFormat("{\"symbol\":\"%s\",\"price\":%.5f}", symBase, mid);
         first = false;
      }
   }
   payload += "]}";

   Comment("Feed Active | Pocket Mode | ", TimeToString(TimeCurrent(), TIME_SECONDS),
           "\nCmd Pipe: ", (hCmdPipe != -1 ? "OK" : "Disconnected"),
           " | Confirm Pipe: ", (hConfirmPipe != -1 ? "OK" : "Disconnected"));

   WriteToPipe(payload);
}

//──────────────────────────────────────────────────────────────────────────────
// Helpers
//──────────────────────────────────────────────────────────────────────────────
void WriteToPipe(string payload) {
   long hPipe = CreateFileW(PipeName, 0x40000000, 0, 0, 3, 0, 0);
   if(hPipe == -1 || hPipe == 0) return;
   uchar buffer[];
   StringToCharArray(payload, buffer, 0, WHOLE_ARRAY, CP_UTF8);
   uint written = 0;
   WriteFile(hPipe, buffer, ArraySize(buffer) - 1, written, 0);
   CloseHandle(hPipe);
}

string GetActualSymbol(string baseSym) {
   if(SymbolInfoDouble(baseSym, SYMBOL_ASK) > 0) return baseSym;
   int total = SymbolsTotal(false);
   for(int i = 0; i < total; i++) {
      string s = SymbolName(i, false);
      if(StringFind(s, baseSym) >= 0) return s;
   }
   return "";
}

string ExtractValue(string json, string key) {
   int start = StringFind(json, key);
   if(start < 0) return "";
   start += StringLen(key);
   if(StringSubstr(json, start, 1) == "\"") start++;
   int endQuote = StringFind(json, "\"", start);
   int endBrace = StringFind(json, "}", start);
   int endComma = StringFind(json, ",", start);
   int end = -1;
   if(endQuote >= 0) end = endQuote;
   else if(endComma >= 0) end = endComma;
   else if(endBrace >= 0) end = endBrace;
   if(end < 0) return "";
   return StringSubstr(json, start, end - start);
}
