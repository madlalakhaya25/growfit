import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { InstallPrompt } from "@/components/install-prompt";
import { Toaster } from "sonner";

// "Matchday" type system — see globals.css and
// docs/AI_FEATURES_AND_IA.md Part 4. Barlow for body copy, Barlow
// Condensed (bold) for titles, scorelines and stat numbers.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Growfit FA",
    template: "%s · Growfit FA",
  },
  description:
    "Track development, build digital player passports, and connect coaches, players, and parents.",
  applicationName: "Growfit FA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Growfit FA",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Growfit FA",
    title: "Growfit FA — Football Development Platform",
    description: "Build the next generation of footballers through structured training and digital player passports.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#A71817" },
    { media: "(prefers-color-scheme: dark)", color: "#A71817" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegistration />
        <InstallPrompt />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
