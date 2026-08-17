"use client";

export default function WorkspaceError({ error, reset }) {
  return (
    <div className="panel state" role="alert">
      <p className="eyebrow">OPERATIONS</p>
      <h1>Something went wrong</h1>
      <p>{error?.message ?? "The workspace failed to render."}</p>
      <button className="primary" type="button" onClick={reset}>Try again</button>
    </div>
  );
}
