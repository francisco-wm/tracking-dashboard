import type { Metadata } from "next";
import { StarlingProvider } from "@wingmaite/starling-ui";

import "./globals.css";

export const metadata: Metadata = {
  title: "wingmaite analytics",
  description: "Internal analytics dashboards for wingmaite.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <StarlingProvider>{children}</StarlingProvider>
      </body>
    </html>
  );
}
