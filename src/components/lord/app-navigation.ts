import {
  BarChart3,
  Calendar,
  Crown,
  FileText,
  FolderOpen,
  GraduationCap,
  Gamepad2,
  LayoutDashboard,
  MessageSquare,
  Mic2,
  Settings,
  Target,
} from "lucide-react";

/** Shared destinations used by the desktop dock and mobile navigation. */
export const APP_NAVIGATION = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderOpen },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/voice", label: "Voice Assistant", icon: Mic2 },
  { to: "/study", label: "Study", icon: GraduationCap },
  { to: "/create-apka-jalwa", label: "Create Apka Jalwa", icon: Gamepad2 },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/tasks", label: "Tasks & Notifications", icon: Target },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/upgrade", label: "LORD Pro", icon: Crown },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export const PRIMARY_NAVIGATION = [
  APP_NAVIGATION[0],
  APP_NAVIGATION[2],
  APP_NAVIGATION[3],
  APP_NAVIGATION[4],
] as const;

export const SECONDARY_NAVIGATION = APP_NAVIGATION.filter(
  (item) => !PRIMARY_NAVIGATION.some((primary) => primary.to === item.to),
);
