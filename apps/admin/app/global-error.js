"use client";

import "./globals.css";

// Root error boundary. Next.js renders this WITHOUT the root layout, so it must
// own its <html>/<body>. It deliberately avoids AuthProvider (which calls
// useRouter) — rendering that during the auto-generated /_global-error prerender
// throws "useContext null" because there is no router context at this level.
export default function GlobalError({ error, retry }) {
  return (
    <html lang="en">
      <body>
        <main>
          <div className="panel state" role="alert">
            <p className="eyebrow">OPERATIONS</p>
            <h1>Something went wrong</h1>
            <p>{error?.message ?? "The admin app failed to render."}</p>
            <button className="primary" type="button" onClick={retry}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
