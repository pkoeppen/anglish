
import type { Metadata } from "next";
import { Faustina, Roboto, UnifrakturCook } from "next/font/google";
import React from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Anglish Wiki",
  description: "Anglish Wiki",
};

const roboto = Roboto({
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

const faustina = Faustina({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-faustina",
});

const unifraktur = UnifrakturCook({
  weight: ["700"],
  style: ["normal"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-unifraktur",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className={`${roboto.variable} ${faustina.variable} ${unifraktur.variable}`}>
        {children}
      </body>
    </html>
  );
}
