/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Static export → สร้าง HTML/CSS/JS ใน frontend/out/
  // Backend (Express) จะ serve ไฟล์เหล่านี้แทน Next.js server
  output: "export",
  trailingSlash: true,

  // URL ชี้ไปที่ backend เสมอ (port 4000)
  // ทั้ง dev และ production ใช้ค่าเดียวกัน
  env: {
    NEXT_PUBLIC_API_URL: "http://localhost:4000/api",
    NEXT_PUBLIC_WS_URL: "ws://localhost:4000/ws",
  },
};

module.exports = nextConfig;
