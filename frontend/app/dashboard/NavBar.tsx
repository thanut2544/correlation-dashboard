"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";

const links = [
  // { href: "/correlation", label: "Correlation" },
  { href: "/", label: "Entry Qualification" },
  { href: "/strategy", label: "Strategy Detail" },
  { href: "/history", label: "History" },
  { href: "/prices", label: "Prices" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border border-slate-800 rounded-full px-4 py-2 flex flex-wrap gap-2 text-sm text-slate-200 shadow">
      {links.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className={classNames(
            "px-3 py-1 rounded-full hover:bg-slate-800 border border-transparent hover:border-slate-700 transition",
            pathname === link.href && "bg-slate-800 border-slate-700"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
