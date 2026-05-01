"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/",        icon: "⬡", label: "Pairs" },
  { href: "/summary", icon: "📊", label: "Daily Summary" },
  { href: "/history", icon: "🗂️",  label: "History" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-slate-900 border-r border-slate-800 flex flex-col z-30">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Fund Dollar</div>
        <div className="text-lg font-extrabold text-slate-50 leading-tight">FX Correlation</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-slate-400 font-mono">15M · Live</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(l => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${active
                  ? "bg-slate-800 text-slate-50 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
            >
              <span className="text-base">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800 text-[10px] text-slate-600">
        Pocket Mode · $500 Account
      </div>
    </aside>
  );
}
