import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./_components/Sidebar";
import ApiStatusPill from "./_components/ApiStatusPill";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
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
  title: "Mezza Risk Assessment",
  description: "Credit intelligence for F&B underwriting",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--mz-page)" }}>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                padding: "12px 24px",
                borderBottom: "1px solid var(--mz-border-on-page)",
                display: "flex",
                justifyContent: "flex-end",
                background: "var(--mz-page)",
              }}
            >
              <ApiStatusPill />
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}