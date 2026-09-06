import { AuthProvider } from "../auth-provider";
import UserShell from "../user-shell";

export default function WorkspaceLayout({ children }) {
  return <AuthProvider><UserShell>{children}</UserShell></AuthProvider>;
}
