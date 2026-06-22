import type { Metadata, Viewport } from "next";
import { DM_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./service-worker-register";
import { InstallPrompt } from "./install-prompt";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "LeadsWave",
  title: {
    default: "LeadsWave",
    template: "%s · LeadsWave",
  },
  description: "Outbound on autopilot.",
  appleWebApp: {
    capable: true,
    title: "LeadsWave",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
