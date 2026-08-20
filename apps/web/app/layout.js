import "./globals.css";
import StorefrontFooter from "./StorefrontFooter";

export const metadata = { title: "PCX Storefront", description: "PCX certified pre-owned marketplace" };
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <StorefrontFooter />
      </body>
    </html>
  );
}
