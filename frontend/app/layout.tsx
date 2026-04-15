import "./styles/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50">
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
