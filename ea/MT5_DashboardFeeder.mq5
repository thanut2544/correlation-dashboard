#include <Trade\Trade.mqh>

#import "kernel32.dll"
long CreateFileW(string lpFileName, uint dwDesiredAccess, uint dwShareMode, ulong lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, long hTemplateFile);
int  WriteFile(long hFile, const uchar &lpBuffer[], uint nNumberOfBytesToWrite, uint &lpNumberOfBytesWritten, ulong lpOverlapped);
int  ReadFile(long hFile, uchar &lpBuffer[], uint nNumberOfBytesToRead, uint &lpNumberOfBytesRead, ulong lpOverlapped);
int  PeekNamedPipe(long hPipe, uchar &lpBuffer[], uint nBufferSize, uint &lpBytesRead, uint &lpTotalBytesAvail, uint &lpBytesLeftThisMessage);
int  CloseHandle(long hObject);
#import

input string PipeName = "\\\\.\\pipe\\mql5_dashboard_feed";
input string CmdPipeName = "\\\\.\\pipe\\mql5_dashboard_trades";
input int UpdateIntervalMs = 500; // Throttle ticks

CTrade trade;
long hCmdPipe = -1;

uint lastUpdate = 0;

int OnInit() {
   Print("Named Pipe Feeder Started -> ", PipeName);
   Print("Command Pipe Listening -> ", CmdPipeName);
   
   // Open command pipe (READ access)
   hCmdPipe = CreateFileW(CmdPipeName, 0x80000000 /*GENERIC_READ*/, 0, 0, 3 /*OPEN_EXISTING*/, 0, 0);
   if(hCmdPipe == -1) {
      Print("Failed to open Command Pipe! Error: ", GetLastError());
   }
   
   EventSetTimer(1); // 1-second interval for command check
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   Print("Named Pipe Feeder Stopped.");
   if(hCmdPipe != -1) CloseHandle(hCmdPipe);
   EventKillTimer();
}

// Helper to find actual symbol in market watch (handles suffixes like EURUSD.m)
string GetActualSymbol(string baseSym) {
   if(SymbolInfoDouble(baseSym, SYMBOL_ASK) > 0) return baseSym;
   int total = SymbolsTotal(false);
   for(int i=0; i<total; i++) {
      string s = SymbolName(i, false);
      if(StringFind(s, baseSym) >= 0) return s;
   }
   return "";
}

void OnTimer() {
   if(hCmdPipe == -1) {
      hCmdPipe = CreateFileW(CmdPipeName, 0x80000000 /*GENERIC_READ*/, 0, 0, 3 /*OPEN_EXISTING*/, 0, 0);
      return;
   }

   uint avail = 0, read = 0, left = 0;
   uchar dummy[1];
   if(PeekNamedPipe(hCmdPipe, dummy, 0, read, avail, left) != 0 && avail > 0) {
      uchar buffer[2048]; // Increased buffer
      uint bytesRead = 0;
      if(ReadFile(hCmdPipe, buffer, 2048, bytesRead, 0) != 0 && bytesRead > 0) {
         string raw = CharArrayToString(buffer, 0, bytesRead, CP_UTF8);
         Print("Received Raw: ", raw);
         
         // Split commands by newline if multiple are sent in one go
         string lines[];
         int n = StringSplit(raw, '\n', lines);
         if(n == 0) { n = 1; ArrayResize(lines, 1); lines[0] = raw; }

         for(int i=0; i<n; i++) {
            string cmdLine = lines[i];
            if(StringLen(cmdLine) < 5) continue;

            string symBase = ExtractValue(cmdLine, "\"symbol\":\"");
            string sym = GetActualSymbol(symBase);
            if(sym == "") {
               Print("Error: Could not find actual symbol for: ", symBase);
               continue;
            }

            if(StringFind(cmdLine, "\"cmd\":\"buy\"") >= 0) {
               double vol = StringToDouble(ExtractValue(cmdLine, "\"volume\":"));
               if(vol > 0) {
                  Print("Executing BUY: ", sym, " (", symBase, ") Vol: ", vol);
                  if(!trade.Buy(vol, sym)) {
                     Print("BUY FAILED: ", sym, " Code: ", trade.ResultRetcode(), " Desc: ", trade.ResultComment());
                  }
               }
            } 
            else if(StringFind(cmdLine, "\"cmd\":\"sell\"") >= 0) {
               double vol = StringToDouble(ExtractValue(cmdLine, "\"volume\":"));
               if(vol > 0) {
                  Print("Executing SELL: ", sym, " (", symBase, ") Vol: ", vol);
                  if(!trade.Sell(vol, sym)) {
                     Print("SELL FAILED: ", sym, " Code: ", trade.ResultRetcode(), " Desc: ", trade.ResultComment());
                  }
               }
            } 
            else if(StringFind(cmdLine, "\"cmd\":\"close\"") >= 0) {
               Print("Executing CLOSE for Symbol: ", sym);
               int closedCount = 0;
               for(int k=PositionsTotal()-1; k>=0; k--) {
                  ulong ticket = PositionGetTicket(k);
                  if(PositionSelectByTicket(ticket)) {
                     if(PositionGetString(POSITION_SYMBOL) == sym) {
                        if(trade.PositionClose(ticket)) closedCount++;
                        else Print("CLOSE FAILED ticket: ", ticket, " Code: ", trade.ResultRetcode());
                     }
                  }
               }
               Print("Closed ", closedCount, " positions for ", sym);
            }
         }
      }
   }
}

string ExtractValue(string json, string key) {
   int start = StringFind(json, key);
   if(start < 0) return "";
   start += StringLen(key);
   
   // Skip quote if present
   if(StringSubstr(json, start, 1) == "\"") start++;
   
   // Find end of value (quote, brace, or comma)
   int end = -1;
   int endQuote = StringFind(json, "\"", start);
   int endBrace = StringFind(json, "}", start);
   int endComma = StringFind(json, ",", start);
   
   if(endQuote >= 0) end = endQuote;
   else if(endComma >= 0) end = endComma;
   else if(endBrace >= 0) end = endBrace;
   
   if(end < 0) return "";
   return StringSubstr(json, start, end - start);
}


void OnTick() {
   uint now = GetTickCount();
   if (now - lastUpdate < UpdateIntervalMs) return; // limit frequency
   lastUpdate = now;
   
   // Core symbols list
   string symbols[] = {"EURUSD","GBPUSD","XAUUSD","USDJPY","AUDUSD","USDCHF","USDCAD","NZDUSD"};
   
   string payload = "{\"prices\":[";
   bool first = true;
   
   for(int i=0; i<ArraySize(symbols); i++) {
      string symBase = symbols[i];
      string sym = GetActualSymbol(symBase);
      if(sym == "") continue;

      double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
      double bid = SymbolInfoDouble(sym, SYMBOL_BID);
      if (ask > 0 && bid > 0) {
         double mid = (ask + bid) / 2.0;
         if(!first) payload += ",";
         payload += StringFormat("{\"symbol\":\"%s\",\"price\":%f}", symBase, mid); // Send base symbol to backend
         first = false;
      }
   }
   payload += "]}";
   
   // Status display
   Comment("Pipe Connected: ", (hCmdPipe != -1), "\nUpdate Time: ", TimeToString(TimeCurrent(), TIME_SECONDS));

   // Write to Named Pipe
   long hPipe = CreateFileW(PipeName, 0x40000000 /*GENERIC_WRITE*/, 0, 0, 3 /*OPEN_EXISTING*/, 0, 0);
   if(hPipe != -1 && hPipe != 0) {
      uchar buffer[];
      StringToCharArray(payload, buffer, 0, WHOLE_ARRAY, CP_UTF8);
      uint written = 0;
      int result = WriteFile(hPipe, buffer, ArraySize(buffer) - 1, written, 0);
      CloseHandle(hPipe);
   }
}


