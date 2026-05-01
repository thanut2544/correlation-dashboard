==========================================
  Trader Correlation Dashboard
  M15 Pairs Trading | Farm Dollar System
==========================================

ความต้องการ
-----------
- Windows 10 หรือ 11
- MetaTrader 5 (MT5) ติดตั้งแล้ว
- ไม่ต้องติดตั้ง Node.js หรือโปรแกรมเพิ่มเติม

วิธีใช้งานครั้งแรก
------------------
1. แตก ZIP นี้ไปยังโฟลเดอร์ที่ต้องการ
   (เช่น C:\trader-dashboard\)

2. เปิดไฟล์ .env ด้วย Notepad แล้วตั้งค่า:
   - ACCOUNT_BALANCE = ยอดเงินในบัญชี MT5 (USD)
   - DAILY_TARGET_PIPS = เป้ากำไรต่อวัน (default: 20)
   - DAILY_DRAWDOWN_PIPS = ขาดทุนสูงสุดต่อวัน (default: 15)

3. ติดตั้ง EA ใน MT5:
   a. เปิด MT5
   b. ไปที่ File > Open Data Folder
   c. เปิดโฟลเดอร์ MQL5 > Experts
   d. คัดลอก ea\MT5_DashboardFeeder.mq5 เข้าไป
   e. ใน MT5 กด F5 เพื่อ refresh
   f. ลาก EA ไปวางบน chart EURUSD (M15)
   g. เปิด "Allow algorithmic trading"
   h. กด OK

4. ดับเบิลคลิก start.bat
   - Browser จะเปิดอัตโนมัติ
   - รอให้ MT5 EA ส่งข้อมูล (~30 วินาที)
   - สัญญาณจะปรากฏเมื่อมีข้อมูลเพียงพอ

วิธีใช้งานทุกวัน
---------------
1. เปิด MT5 → ตรวจสอบว่า EA ทำงานอยู่
2. ดับเบิลคลิก start.bat
3. ดู Dashboard บน Browser
4. เมื่อเสร็จ: ปิด position ที่ค้างอยู่ก่อน
   แล้วกด Ctrl+C ในหน้าต่าง start.bat

เวลาที่ระบบเทรด (เวลาไทย)
-------------------------
- London Session:  14:00 - 23:00 น.
- New York Session: 19:00 - 04:00 น.
- นอกเวลานี้: ระบบไม่เปิด trade ใหม่

Farm Dollar Rules (ในระบบ)
--------------------------
- ระบบหยุดเองเมื่อกำไรถึงเป้าต่อวัน
- ระบบหยุดเองเมื่อขาดทุนถึง limit ต่อวัน
- Reset ทุกเที่ยงคืน (เวลาไทย)
- Pocket Mode (<$2,000): lot 0.01 fixed

ปัญหาที่พบบ่อย
--------------
Q: Dashboard เปิดแต่ไม่มีข้อมูล
A: ตรวจสอบว่า MT5 EA ทำงานอยู่
   (มีหน้าต่าง EA Log แสดงข้อความ)

Q: EA ติด "Not connected"
A: ให้รัน start.bat ก่อน แล้วค่อยเปิด chart ใหม่

Q: ต้องการเปลี่ยนการตั้งค่า
A: แก้ไขไฟล์ .env แล้ว restart start.bat

==========================================
