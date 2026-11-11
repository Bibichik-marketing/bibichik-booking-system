import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {title:"BiBiChik Reservations",description:"Reserve a table at BiBiChik SS2 or Sunway 163.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({ children }: Readonly<{children:React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }

