import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Swami Samartha Mess - Premium Mess Management System",
  description: "Automate daily tiffin entries, billing, payments, and invoices for your catering and mess business.",
  keywords: "mess management, tiffin management, invoice generation, meal tracking, Swami Samartha Mess",
  authors: [{ name: "Swami Samartha Mess" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground transition-colors duration-150">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
