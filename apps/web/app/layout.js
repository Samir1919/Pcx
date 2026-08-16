import "./globals.css";

export const metadata = { title: "PCX Storefront", description: "PCX certified pre-owned marketplace" };
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
