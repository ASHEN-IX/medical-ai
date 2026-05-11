"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ClipboardList, 
  MessageSquare, 
  Calendar, 
  Settings, 
  History, 
  AlertCircle, 
  ShieldCheck,
  Stethoscope,
  Activity,
  Truck
} from "lucide-react";

interface SidebarProps {
  navItems: { href: string; label: string }[];
  isDoctor: boolean;
}

const iconMap: Record<string, any> = {
  "/diagnosis": ClipboardList,
  "/manual-tests": Activity,
  "/results": ShieldCheck,
  "/chat": MessageSquare,
  "/appointments": Calendar,
  "/medications": Stethoscope,
  "/alerts": AlertCircle,
  "/prevention-plan": LayoutDashboard,
  "/transportation": Truck,
  "/consultation-history": History,
  "/history": History,
  "/doctor": LayoutDashboard,
  "/doctor/reviews": ClipboardList,
};

export default function Sidebar({ navItems, isDoctor }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 glass-sidebar pt-20">
      <div className="flex h-full flex-col justify-between px-4 pb-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = iconMap[item.href] || LayoutDashboard;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.1)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className={`h-5 w-5 transition-colors ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                {item.label}
                
                {item.href === "/appointments" && (
                  <span className="ml-auto flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]" />
                )}

                {isActive && item.href !== "/appointments" && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/5">
          <Link
            href="/settings"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all"
          >
            <Settings className="h-5 w-5 text-slate-500 group-hover:text-slate-300" />
            Settings
          </Link>
        </div>
      </div>
    </aside>
  );
}
