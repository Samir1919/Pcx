"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { storefrontApi } from "../../../lib/storefront-api";
import { money } from "../../../lib/format";
import PassportInfoModal from "../PassportInfoModal";
import BuyFlow from "../BuyFlow";

export default function PassportPage() {
  const params = useParams();
  const pcxId = params?.pcxId;
  const [passport, setPassport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pcxId) return;
    let active = true;
    setLoading(true);
    storefrontApi.passport(pcxId)
      .then((result) => { if (active) { setPassport(result.data); setError(null); } })
      .catch((err) => { if (active) { setError(err.message); setPassport(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pcxId]);

  return (
    <main>
      <div className="topbar">
        <div className="topbarInner">
          <a className="brand" href="/storefront" aria-label="PCX Storefront home"><b>PCX</b><small>CERTIFIED PRE-OWNED</small></a>
          <nav aria-label="Primary"><a href="/storefront">Storefront</a></nav>
        </div>
      </div>
      <div className="wrap">
        <div className="passport">
          <a className="back" href="/storefront">← Back to storefront</a>
          {loading ? <p className="state" role="status">Loading passport…</p> : error ? <div className="banner error" role="alert"><span>{error}</span></div> : passport ? (
            <div className="card">
              <PassportInfoModal triggerAs="span" triggerLabel="Public passport" triggerClassName="pill pill-link" />
              <h1>{passport.name}</h1>
              <div className="meta">PCX item {passport.pcxItemId}</div>
              <a className="pill pill-link" href={`/model/${encodeURIComponent(passport.modelId)}`}>View full model specifications</a>
              <div className="price">{money(passport.price)}<small>PCX-set price</small></div>
              <dl>
                <div><dt>Status</dt><dd>{passport.status}</dd></div>
                <div><dt>Grade</dt><dd>{passport.grade ?? "Not graded"}</dd></div>
                <div><dt>Health score</dt><dd>{passport.healthScore ?? "—"}</dd></div>
                <div><dt>Published</dt><dd>{passport.publishedAt ? new Date(passport.publishedAt).toLocaleDateString() : "—"}</dd></div>
              </dl>
              {passport.verificationSummary && <p className="meta" style={{ marginTop: 18 }}>{passport.verificationSummary}</p>}
              <BuyFlow listing={passport} />
            </div>
          ) : <p className="state">Passport not found.</p>}
        </div>
      </div>
    </main>
  );
}
