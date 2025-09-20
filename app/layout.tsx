import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/lib/user-context";
import { GroupProvider } from "@/lib/group-context";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GroupBet - NFL Betting Tracker",
  description: "Track group bets on NFL games with your friends",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <GroupProvider>
            <UserProvider>
              {children}
            </UserProvider>
          </GroupProvider>
        </Providers>
      </body>
    </html>
  );
}
