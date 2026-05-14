import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./_components/Sidebar";
import ApiStatusPill from "./_components/ApiStatusPill";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata = {
  title: "Mezza Risk Assessment Platform",
  description: "F&B credit risk assessment and underwriting workflow",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <header className="flex justify-end px-8 py-4 border-b border-[color:var(--mz-border)]">
              <ApiStatusPill />
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}