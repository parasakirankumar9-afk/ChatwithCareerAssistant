import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Intel - AI Career Assistant",
  description:
    "Upload your resume and job descriptions. Get instant career intelligence powered by AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
