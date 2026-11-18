import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "react-router";

import { StrictMode, useEffect } from "react";

import { QueryCache, QueryClient, QueryClientProvider, type Query } from "@tanstack/react-query";
import { pushError } from "~/components/error_popout";

import { CssBaseline, InitColorSchemeScript } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./theme";

import { SnackbarProvider } from "notistack";

import type { Route } from "./+types/root";
import "./app.css";

const failedPolls = new WeakSet<Query<unknown, unknown>>();
const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError(error, query) {
            if (query.meta?.polling) {
                if (failedPolls.has(query)) return;
                failedPolls.add(query);
            }
            const context = query.meta?.errorContext;
            pushError(error, typeof context === "string" ? context : "Load data");
        },
        onSuccess(_data, query) {
            failedPolls.delete(query);
        },
    }),
});

export const links: Route.LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    },
];

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" type="image/svg+xml" href="/Icon-square.svg" />
                <Meta />
                <Links />
            </head>
            <body>
                <InitColorSchemeScript attribute="class" />
                <ThemeProvider theme={theme}>
                    <SnackbarProvider maxSnack={8}>
                        <CssBaseline />
                        {children}
                    </SnackbarProvider>
                </ThemeProvider>
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return (
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <Outlet />
            </QueryClientProvider>
        </StrictMode>
    );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    useEffect(() => {
        if (isRouteErrorResponse(error)) {
            const detail =
                error.status === 404 ? "Page not found" : error.statusText || "Request failed";
            pushError(detail, `HTTP ${error.status}`);
        } else {
            pushError(import.meta.env.DEV ? error : "An unexpected error occurred.");
        }
    }, [error]);

    return (
        <main className="pt-16 p-4 container mx-auto">
            <a href="/path_select">Return to start</a>
        </main>
    );
}

export function meta({}: Route.MetaArgs) {
    return [{ title: "TXT Clean to EPUB" }];
}
