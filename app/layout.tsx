import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ReplicacheProvider } from "@/lib/replicache-provider";
import { AuthProvider } from "@/lib/auth-provider";
import "./globals.css";
import React from "react";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import OfflineStatus from "@/components/OfflineStatus";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Replicache Todo App",
  description: "A todo app powered by Replicache",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ReplicacheProvider>
            <OfflineStatus />
            <ServiceWorkerRegister />
            {children}
          </ReplicacheProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
