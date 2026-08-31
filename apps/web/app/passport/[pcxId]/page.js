"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { storefrontApi, mediaUrl } from "../../../lib/storefront-api";
import { money, gradeLabel, specValue } from "../../../lib/format";
import PassportInfoModal from "../PassportInfoModal";
import BuyFlow from "../BuyFlow";
import StorefrontNav from "../../StorefrontNav";

export default function PassportPage() {
  const params = useParams();
  const pcxId = params?.pcxId;
  const [passport, setPassport] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
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

  const mediaIds = passport?.mediaIds ?? [];
  const activeMedia = selectedMedia ?? mediaIds[0] ?? null;

  return (
    <main>
      <StorefrontNav />
      <div className="wrap">
        <div className="passport">
          <a className="back" href="/storefront">← Back to storefront</a>
          {loading ? <p className="state" role="status">Loading passport…</p> : error ? <div className="banner error" role="alert"><span>{error}</span></div> : passport ? (
            <div className="card">
              <PassportInfoModal triggerAs="span" triggerLabel="Public passport" triggerClassName="pill pill-link" />
              <h1>{passport.name}</h1>
              <div className="meta">PCX item {passport.pcxItemId}</div>
              {activeMedia ? (
                <div className="gallery">
                  <img className="galleryMain" src={mediaUrl(activeMedia)} alt={passport.name} />
                  {mediaIds.length > 1 && (
                    <div className="galleryThumbs">
                      {mediaIds.map((id) => (
                        <button key={id} type="button" className={`galleryThumb${id === activeMedia ? " active" : ""}`} onClick={() => setSelectedMedia(id)} aria-label="Show photo">
                          <img src={mediaUrl(id, { thumb: true })} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              <div className="price">{money(passport.price)}<small>PCX-set price</small></div>
              <dl>
                <div><dt>Status</dt><dd>{passport.status}</dd></div>
                <div><dt>Grade</dt><dd>{gradeLabel(passport.grade)}</dd></div>
                <div><dt>Health score</dt><dd>{passport.healthScore ?? "—"}</dd></div>
                <div><dt>Published</dt><dd>{passport.publishedAt ? new Date(passport.publishedAt).toLocaleDateString() : "—"}</dd></div>
              </dl>
              <h2 className="specTitle">Specifications</h2>
              {(!passport.specifications || passport.specifications.length === 0) ? (
                <p className="state">No specifications published for this model yet.</p>
              ) : (
                <table className="specTable">
                  <tbody>
                    {passport.specifications.map((spec) => (
                      <tr key={spec.key}>
                        <th scope="row">{spec.label}</th>
                        <td>{specValue(spec)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {passport.verificationSummary && <p className="meta" style={{ marginTop: 18 }}>{passport.verificationSummary}</p>}
              <BuyFlow listing={passport} />
            </div>
          ) : <p className="state">Passport not found.</p>}
        </div>
      </div>
    </main>
  );
}
