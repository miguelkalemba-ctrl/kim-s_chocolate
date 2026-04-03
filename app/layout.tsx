"use client";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { useEffect, useState } from "react";
import { UserCircle } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme toggle (chocolate / dark)
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "chocolate";
    try {
      const stored = localStorage.getItem("kwt_theme");
      return stored === "dark" ? stored : "chocolate";
    } catch {
      return "chocolate";
    }
  });
  const [activeView, setActiveView] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    const params = new URLSearchParams(window.location.search);
    return params.get("view") || "dashboard";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("kwt_theme", theme);
    } catch {
      // ignore storage write issues
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark");
    if (theme === "dark") root.classList.add("dark");
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
      // best-effort registration
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const nextParams = new URLSearchParams(window.location.search);
      setActiveView(nextParams.get("view") || "dashboard");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navClass = (isActive: boolean) =>
    `px-3 py-2 rounded-lg transition-colors ${
      isActive
        ? "text-zinc-200 bg-zinc-900"
        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70"
    }`;

  return (
    <html lang="en" className={theme === "dark" ? "dark" : ""}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen bg-background text-foreground`}>
        {/* Sidebar Navigation */}
        <aside className="hidden md:flex flex-col w-56 bg-zinc-950/90 border-r border-zinc-800 p-6 gap-8 shadow-xl">
          <div className="relative w-32 h-24 shrink-0 flex items-center justify-center" aria-label="App logo">
            <div className="absolute inset-0 bg-black/100 z-0" />
            <div className="relative z-10">
              <Image src="/sidebar-logo.png" alt="App logo" width={128} height={96} className="object-contain" />
            </div>
          </div>
          <nav className="flex flex-col gap-4 flex-1 justify-center">
            <Link href="/?view=dashboard" className={navClass(activeView === "dashboard")} onClick={() => setActiveView("dashboard")}>Dashboard</Link>
            <Link href="/?view=items" className={navClass(activeView === "items")} onClick={() => setActiveView("items")}>Packing Materials</Link>
            <Link href={`/?view=${activeView}&panel=analytics`} className={navClass(false)}>Analytics</Link>
            <Link href={`/?view=${activeView}&panel=settings`} className={navClass(false)}>Settings</Link>
          </nav>
          <div className="mt-auto flex items-center gap-3">
            <UserCircle className="w-8 h-8 text-zinc-400" />
            <div>
              <div className="font-semibold">Admin User</div>
              <div className="text-xs text-zinc-500">admin@kimschocolate.be</div>
            </div>
          </div>
          <div className="mt-6">
            <div className="text-xs text-zinc-400 mb-1">Current Theme: <span className="text-orange-400 font-bold">{theme}</span></div>
            <label htmlFor="theme-select" className="sr-only">Theme</label>
            <select
              id="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value as "chocolate" | "dark")}
              className="w-full bg-zinc-800 text-white rounded px-2 py-1 text-xs"
              aria-label="Select theme"
            >
              <option value="chocolate">🍫 Chocolate</option>
              <option value="dark">🌙 Dark</option>
            </select>
          </div>
        </aside>
        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-screen pb-24 md:pb-0">
          {children}

          <div className="md:hidden fixed bottom-4 left-4 z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="relative w-14 h-14 rounded-full border border-zinc-700 bg-zinc-950/95 shadow-xl"
              aria-label="Open app menu"
              title="Open app menu"
            >
              <span className="absolute inset-2 flex items-center justify-center">
                <span className="absolute inset-0 bg-black/100 z-0" />
                <span className="relative z-10">
                  <Image src="/sidebar-logo.png" alt="App logo" width={56} height={42} className="object-contain" />
                </span>
              </span>
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-40 bg-black/70" onClick={() => setMobileMenuOpen(false)}>
              <div
                className="absolute left-4 right-4 bottom-20 rounded-2xl border border-zinc-700 bg-zinc-950 p-4 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs text-zinc-500">Quick Menu</div>
                <Link
                  href="/?view=dashboard"
                  onClick={() => {
                    setActiveView("dashboard");
                    setMobileMenuOpen(false);
                  }}
                  className={navClass(activeView === "dashboard")}
                >
                  Dashboard
                </Link>
                <Link
                  href="/?view=items"
                  onClick={() => {
                    setActiveView("items");
                    setMobileMenuOpen(false);
                  }}
                  className={navClass(activeView === "items")}
                >
                  Packing Materials
                </Link>
                <Link
                  href={`/?view=${activeView}&panel=analytics`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={navClass(false)}
                >
                  Analytics
                </Link>
                <Link
                  href={`/?view=${activeView}&panel=settings`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={navClass(false)}
                >
                  Settings
                </Link>
                <div className="pt-1 text-xs text-zinc-400">
                  <div className="font-semibold text-zinc-200">Admin User</div>
                  <div className="text-zinc-500">admin@kimschocolate.be</div>
                </div>
                <div className="pt-2 border-t border-zinc-800">
                  <label htmlFor="theme-select-mobile" className="text-xs text-zinc-500">Theme</label>
                  <select
                    id="theme-select-mobile"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as "chocolate" | "dark")}
                    className="mt-1 w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs"
                    aria-label="Select theme"
                  >
                    <option value="chocolate">🍫 Chocolate</option>
                    <option value="dark">🌙 Dark</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </main>
      </body>
    </html>
  );
}
