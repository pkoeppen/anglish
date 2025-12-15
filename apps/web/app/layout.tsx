import type { Metadata } from "next";
import { Source_Code_Pro } from "next/font/google";
import localFont from "next/font/local";
import React from "react";

import "./globals.css";

const juxtaSansMono = localFont({
  src: [
    {
      path: "../public/fonts/JuxtaSansMono-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/JuxtaSansMono-ExtraBlack.woff2",
      weight: "950",
      style: "normal",
    },
  ],
  variable: "--font-juxta-sans-mono",
});

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-source-code-pro",
});

export const metadata: Metadata = {
  title: "Peter Koeppen ᛃ Software Engineer",
  description:
    "Peter Koeppen is a software engineer with a passion for building complex, beautiful systems.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="relative" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem("theme");
                  if (stored === "dark") {
                    document.documentElement.classList.add("dark");
                  } else if (stored === "light") {
                    document.documentElement.classList.remove("dark");
                  } else {
                    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                    if (systemDark) {
                      document.documentElement.classList.add("dark");
                    }
                  }
                } catch (e) {}
              })();
          `,
          }}
        />
      </head>
      <body className={`${juxtaSansMono.variable} ${sourceCodePro.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
