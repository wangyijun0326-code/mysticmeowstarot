import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { GestureProvider } from "@/components/gesture/gesture-provider";
import { BgmPlayer } from "@/components/bgm-player";

function useEnsureSession() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        supabase.auth.signInAnonymously();
      }
    });
  }, []);
}

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mystic Meows Tarot" },
      { name: "description", content: "沉浸式猫咪塔罗占卜体验。内置每日一签、时间流、二选一复合牌阵，支持无限次免费洗牌，配合流畅的在线揭牌仪式感动效，搭载 AI 灵性后台，实时为你梳理错综复杂的复合运势。" },
      { property: "og:title", content: "Mystic Meows Tarot" },
      {
        property: "og:description",
        content: "沉浸式猫咪塔罗抽牌体验，含洗牌、揭牌仪式与 AI 深度解读。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Mystic Meows Tarot" },
      { property: "og:description", content: "沉浸式猫咪塔罗占卜体验。内置每日一签、时间流、二选一复合牌阵，支持无限次免费洗牌，配合流畅的在线揭牌仪式感动效，搭载 AI 灵性后台，实时为你梳理错综复杂的复合运势。" },
      { name: "twitter:description", content: "沉浸式猫咪塔罗占卜体验。内置每日一签、时间流、二选一复合牌阵，支持无限次免费洗牌，配合流畅的在线揭牌仪式感动效，搭载 AI 灵性后台，实时为你梳理错综复杂的复合运势。" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/rEGPJ3HYt2SFBvk6q7Kn6NXEO9I2/social-images/social-1782527116541-menu.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/rEGPJ3HYt2SFBvk6q7Kn6NXEO9I2/social-images/social-1782527116541-menu.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/assets/back.png" },
      // NOTE: Google Fonts (fonts.googleapis.com / fonts.gstatic.com) are removed
      // on purpose. In mainland China those Google connections get reset/hang,
      // and a render-blocking <link rel="stylesheet"> in <head> then blocks first
      // paint on every device — causing "网络连接关闭 / 打不开". The CSS font stack
      // in styles.css already falls back to Songti SC / STSong / serif, which are
      // present on Chinese systems, so the look is preserved without the remote fetch.
      { rel: "canonical", href: "/" },
    ],

    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Mystic Meows Tarot",
          applicationCategory: "EntertainmentApplication",
          description: "沉浸式猫咪塔罗抽牌体验，含洗牌、揭牌仪式与 AI 深度解读。",
        }),
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
    <html lang="zh-CN">
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
  useEnsureSession();

  // The gesture engine relies on browser APIs (camera, window, document),
  // so it only mounts on the client after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      {mounted ? (
        <GestureProvider>
          <Outlet />
          <BgmPlayer />
        </GestureProvider>
      ) : (
        <Outlet />
      )}
    </QueryClientProvider>
  );
}
