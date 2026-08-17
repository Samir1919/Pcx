"use client";

export default function StorefrontError({ error, reset }) {
  return (
    <main>
      <div className="topbar">
        <div className="topbarInner">
          <a className="brand" href="/storefront"><b>PCX</b><small>CERTIFIED PRE-OWNED</small></a>
        </div>
      </div>
      <div className="wrap">
        <div className="panel state" role="alert">
          <p className="eyebrow">STOREFRONT</p>
          <h1>Something went wrong</h1>
          <p>{error?.message ?? "The page failed to render."}</p>
          <button className="primary" type="button" onClick={reset}>Try again</button>
        </div>
      </div>
    </main>
  );
}
