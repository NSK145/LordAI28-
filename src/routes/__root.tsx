import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, useState } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { WakeWordProvider } from "../components/lord/WakeWordProvider";
import { AppContextProvider } from "../components/lord/AppContextProvider";
import { CalendarProvider } from "../components/lord/CalendarProvider";
import { setupApiInterceptor } from "../lib/api-interceptor";
import { getUserSettings } from "../lib/user-settings.functions";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_MODE, type LordMode } from "../lib/modes";
import { supabase } from "../integrations/supabase/client";
import { X } from "lucide-react";

function UserSettingsHydrator({ children }: { children: ReactNode }) {
  const { data: userSettings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getUserSettings,
  });

  const voiceMode: LordMode = (userSettings?.default_mode as LordMode) ?? DEFAULT_MODE;
  const autoSpeak = userSettings?.auto_speak ?? true;
  const voiceRate = userSettings?.voice_rate ?? 1;

  return (
    <WakeWordProvider mode={voiceMode} autoSpeak={autoSpeak} voiceRate={voiceRate}>
      {children}
    </WakeWordProvider>
  );
}

function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

registerServiceWorker();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const displayError = error instanceof Error ? error : new Error(String(error));
  console.error(displayError);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(displayError, { boundary: "tanstack_root_error_component" });
  }, [displayError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "theme-color", content: "#0a0e1a" },
      { title: "LORD AI — Personal Intelligence" },
      {
        name: "description",
        content: "LORD — the autonomous AI.",
      },
      { property: "og:title", content: "LORD AI — Personal Intelligence" },
      {
        property: "og:description",
        content:
          "NSK145 analyzes and resolves all end-to-end errors in a GitHub repository, ensuring full application functionality.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "LORD AI — Personal Intelligence" },
      {
        name: "description",
        content:
          "NSK145 analyzes and resolves all end-to-end errors in a GitHub repository, ensuring full application functionality.",
      },
      {
        name: "twitter:description",
        content:
          "NSK145 analyzes and resolves all end-to-end errors in a GitHub repository, ensuring full application functionality.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2f40c7c4-5be3-4e13-8e54-13b7f6fed270/id-preview-43e60b92--5ed0f069-9f8e-4bd0-ab56-d3a9923cde2b.lovable.app-1781964593862.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2f40c7c4-5be3-4e13-8e54-13b7f6fed270/id-preview-43e60b92--5ed0f069-9f8e-4bd0-ab56-d3a9923cde2b.lovable.app-1781964593862.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/lord-icon.png" },
      { rel: "icon", href: "/lord-icon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    setupApiInterceptor();
    void import("../lib/mobile-native").then(({ initializeMobileRuntime }) =>
      initializeMobileRuntime(),
    );
    let disposed = false;
    let removeListeners: () => void = () => {};
    void import("../lib/mobile-native")
      .then(({ registerMobileNavigation }) =>
        registerMobileNavigation(
          (route) => {
            void router.navigate({ to: route as never });
          },
          (active) => {
            if (active) {
              void supabase.auth.startAutoRefresh();
              void supabase.auth.getSession().catch(() => undefined);
            } else {
              supabase.auth.stopAutoRefresh();
            }
          },
        ),
      )
      .then((remove) => {
        if (disposed) remove();
        else removeListeners = remove;
      });
    return () => {
      disposed = true;
      removeListeners();
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppContextProvider>
        <CalendarProvider>
          <UserSettingsHydrator>
            <ConnectivityNotice />
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </UserSettingsHydrator>
        </CalendarProvider>
      </AppContextProvider>
    </QueryClientProvider>
  );
}

function ConnectivityNotice() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => {
      const connected = navigator.onLine;
      setOnline(connected);
      if (!connected) {
        setDismissed(false);
        setExpanded(true);
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    let removeNativeListener: () => void = () => {};
    let disposed = false;
    void import("../lib/mobile-native").then(async ({ isNativeMobile, mobileNetwork }) => {
      if (!isNativeMobile()) return;
      const status = await mobileNetwork.status().catch(() => null);
      if (status) {
        setOnline(status.connected);
        if (!status.connected) {
          setDismissed(false);
          setExpanded(true);
        }
      }
      const handle = await mobileNetwork.listen(({ connected }) => {
        setOnline(connected);
        if (!connected) {
          setDismissed(false);
          setExpanded(true);
        }
      });
      if (disposed) void handle.remove();
      else removeNativeListener = () => void handle.remove();
    });
    return () => {
      disposed = true;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      removeNativeListener();
    };
  }, []);

  useEffect(() => {
    if (online || !expanded) return;
    let timer = window.setTimeout(() => setExpanded(false), 3000);
    const resetCollapseTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setExpanded(false), 3000);
    };
    window.addEventListener("pointerdown", resetCollapseTimer, { passive: true });
    window.addEventListener("keydown", resetCollapseTimer);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", resetCollapseTimer);
      window.removeEventListener("keydown", resetCollapseTimer);
    };
  }, [online, expanded]);

  if (online || dismissed) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-3 z-[100] mx-auto transition-all duration-300 ${expanded ? "inset-x-3 max-w-xl" : "right-3"}`}
    >
      {expanded ? (
        <div className="relative rounded-2xl border border-amber-300/20 bg-slate-950/95 px-10 py-3 text-center text-sm leading-6 text-amber-100 shadow-lg">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss offline notice"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-amber-100/65 transition-colors hover:bg-white/10 hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <X className="h-4 w-4" />
          </button>
          You’re offline. Saved study data stays available; new messages and uploads need a
          connection.
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Offline. Show connection details."
          aria-expanded={false}
          title="Show connection details"
          className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-slate-950/95 px-3 py-1.5 text-xs font-medium text-amber-100 shadow-md transition-colors duration-200 hover:border-amber-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
          Offline
        </button>
      )}
    </div>
  );
}
