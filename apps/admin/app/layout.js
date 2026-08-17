import "./globals.css";
import { AuthProvider } from "./auth-provider";

export const metadata = { title: "PCX Admin", description: "PCX privileged operations workspace" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
