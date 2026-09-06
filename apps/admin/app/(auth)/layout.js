import { AuthProvider } from "../auth-provider";

export default function AuthLayout({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
