import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AR Door Visualizer",
  description: "Upload your door, see it in AR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
