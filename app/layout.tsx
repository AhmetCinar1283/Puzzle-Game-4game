import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import PresetSeeder from "./src/components/PresetSeeder";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = 'https://syncron.polyvoclub.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Syncron — Grid Puzzle Game',
    template: '%s | Syncron',
  },
  description:
    'Syncron is a free browser puzzle game. Control two objects at once across a neon grid — ice slides, teleporters, conveyors, and more. Can you sync them to their targets?',
  keywords: [
    'puzzle game',
    'grid puzzle',
    'browser game',
    'free puzzle game',
    'logic game',
    'syncron',
    'neon puzzle',
    'two player puzzle',
    'simultaneous movement',
    'level editor',
  ],
  authors: [{ name: 'Polyvo Club', url: BASE_URL }],
  creator: 'Polyvo Club',
  publisher: 'Polyvo Club',
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: 'website',
    url: BASE_URL,
    siteName: 'Syncron',
    title: 'Syncron — Grid Puzzle Game',
    description:
      'Move two neon objects to their targets simultaneously. Navigate ice, teleporters, conveyors and more in this free browser puzzle game.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Syncron — Grid Puzzle Game',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Syncron — Grid Puzzle Game',
    description:
      'Move two neon objects to their targets simultaneously. Free browser puzzle game with a built-in level editor.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  icons: {
    icon: '/icon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3798429741438186"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Syncron',
              url: 'https://syncron.polyvoclub.com',
              description:
                'Syncron is a free browser-based grid puzzle game where you control two objects simultaneously and navigate them to their targets. Features include ice slides, teleporters, conveyors, power nodes, and a built-in level editor.',
              applicationCategory: 'Game',
              genre: 'Puzzle',
              operatingSystem: 'Any',
              browserRequirements: 'Requires JavaScript',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              author: {
                '@type': 'Organization',
                name: 'Polyvo Club',
                url: 'https://polyvoclub.com',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PresetSeeder />
        {children}
      </body>
    </html>
  );
}
