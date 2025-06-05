import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ReplicacheProvider } from "@/lib/replicache-provider";
import "./globals.css";

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
        <ReplicacheProvider>
          {children}
        </ReplicacheProvider>
      </body>
    </html>
  );
}
