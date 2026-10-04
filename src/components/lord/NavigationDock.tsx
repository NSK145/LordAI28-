import { Link, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  GraduationCap,
  Target,
  Search,
  FileText,
  Settings,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/study", label: "Study", icon: GraduationCap },
  { to: "/tasks", label: "Tasks", icon: Target },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const STORAGE_KEY = "lord-sidebar-collapsed";

function NavTooltip({ label, visible }: { label: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -8, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -6, scale: 0.92 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="pointer-events-none absolute left-full ml-3 z-50"
          role="tooltip"
        >
          <div
            className="whitespace-nowrap rounded-lg border border-border bg-popover/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg"
            style={{
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            {label}
            {/* Arrow */}
            <span
              className="absolute right-full top-1/2 -translate-y-1/2"
              style={{
                borderTop: "5px solid transparent",
                borderBottom: "5px solid transparent",
                borderRight: "6px solid rgba(183,198,222,0.16)",
                width: 0,
                height: 0,
                display: "block",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  collapsed,
  index,
  isExpanding,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
  index: number;
  isExpanding: boolean;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (collapsed) {
      tooltipTimer.current = setTimeout(() => setTooltipVisible(true), 150);
    }
  }, [collapsed]);

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltipVisible(false);
  }, []);

  useEffect(() => {
    if (!collapsed) {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      setTooltipVisible(false);
    }
  }, [collapsed]);

  // Stagger delay for expand animation
  const staggerDelay = isExpanding ? index * 0.04 : 0;

  return (
    <li className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Link
        to={to}
        aria-label={label}
        className={cn(
          "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
          active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )}
        style={
          active
            ? {
                background: "rgba(66,133,244,0.12)",
              }
            : undefined
        }
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            (e.currentTarget as HTMLButtonElement).click();
          }
        }}
      >
        {/* Hover background */}
        <span
          className={cn(
            "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-180",
            !active && "group-hover:opacity-100",
          )}
          style={{ background: "rgba(255,255,255,0.05)" }}
        />

        <motion.div
          animate={collapsed ? { opacity: 0, x: -6 } : { opacity: 1, x: 0 }}
          transition={{
            duration: 0.22,
            ease: "easeInOut",
            delay: collapsed ? 0 : staggerDelay,
          }}
          className="relative z-10"
        >
          <Icon
            className={cn(
              "h-5 w-5 transition-all duration-200",
              active ? "text-primary" : "group-hover:scale-105",
            )}
          />
        </motion.div>
      </Link>

      {/* Tooltip — only when collapsed */}
      {collapsed && <NavTooltip label={label} visible={tooltipVisible} />}
    </li>
  );
}

export function NavigationDock() {
  const location = useLocation();
  const path = location.pathname;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [isExpanding, setIsExpanding] = useState(false);

  const toggle = useCallback(() => {
    const next = !collapsed;
    // if currently collapsed, we are expanding → stagger icons in
    setIsExpanding(collapsed);
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }, [collapsed]);

  // Keyboard shortcut: Ctrl+B / Cmd+B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  return (
    <motion.nav
      aria-label="Primary navigation"
      className="custom-scrollbar fixed left-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center md:flex"
      animate={{ width: collapsed ? 12 : 56 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{ overflow: "visible" }}
    >
      {/* Main dock panel */}
      <motion.div
        className="relative flex flex-col items-center gap-1.5 rounded-2xl border border-border/80 bg-slate-950/80 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.3)] transition-colors"
        animate={{ width: collapsed ? 12 : 56 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        style={{
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          overflow: "visible",
          minHeight: "auto",
        }}
      >
        {/* Nav items */}
        <ul className="flex flex-col items-center gap-1 px-1.5">
          {NAV.map(({ to, label, icon }, index) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <NavItem
                key={to}
                to={to}
                label={label}
                icon={icon}
                active={active}
                collapsed={collapsed}
                index={index}
                isExpanding={isExpanding}
              />
            );
          })}
        </ul>

      </motion.div>

      {/* Floating toggle button */}
      <motion.button
        onClick={toggle}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        className={cn(
          "absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
          "transition-colors duration-200 hover:text-foreground",
        )}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.92 }}
        style={{
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <motion.div
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ChevronRight className="h-3.5 w-3.5 text-cyan-400" />
        </motion.div>
      </motion.button>
    </motion.nav>
  );
}
