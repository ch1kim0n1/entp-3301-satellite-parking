import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Satellite Parking",
  description: "UTD parking occupancy checker using overhead imagery and computer vision.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
