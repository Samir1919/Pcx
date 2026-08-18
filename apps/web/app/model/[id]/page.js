"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { storefrontApi } from "../../../lib/storefront-api";

function displayValue(spec) {
  if (spec.value == null) return "—";
  if (spec.dataType === "BOOLEAN") return spec.value ? "Yes" : "No";
  const unit = spec.unit ? ` ${spec.unit}` : "";
  return `${spec.value}${unit}`;
}

export default function ProductModelPage() {
  const params = useParams();
  const modelId = params?.id;
  const [model, setModel] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([storefrontApi.categories(), storefrontApi.brands()])
      .then(([cats, brs]) => { if (active) { setCategories(cats.data); setBrands(brs.data); } })
      .catch(() => { });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!modelId) return;
    let active = true;
    setLoading(true);
    storefrontApi.productModel(modelId)
      .then((result) => { if (active) { setModel(result.data); setError(null); } })
      .catch((err) => { if (active) { setError(err.message); setModel(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [modelId]);

  const categoryName = categories.find((c) => c.id === model?.categoryId)?.name ?? "Unknown category";
  const brandName = brands.find((b) => b.id === model?.brandId)?.name ?? "Unknown brand";

  return (
    <main>
      <div className="topbar">
        <div className="topbarInner">
          <a className="brand" href="/storefront" aria-label="PCX Storefront home"><b>PCX</b><small>CERTIFIED PRE-OWNED</small></a>
          <nav aria-label="Primary"><a href="/storefront">Storefront</a></nav>
        </div>
      </div>
      <div className="wrap">
        <a className="back" href="/storefront">← Back to storefront</a>
        {loading ? <p className="state" role="status">Loading model…</p> : error ? <div className="banner error" role="alert"><span>{error}</span></div> : model ? (
          <div className="card model">
            <h1>{model.name}</h1>
            <div className="meta">{brandName} · {categoryName}{model.modelCode ? ` · ${model.modelCode}` : ""}</div>
            <h2 className="specTitle">Specifications</h2>
            {(!model.specifications || model.specifications.length === 0) ? (
              <p className="state">No specifications published for this model yet.</p>
            ) : (
              <table className="specTable">
                <tbody>
                  {model.specifications.map((spec) => (
                    <tr key={spec.key}>
                      <th scope="row">{spec.label}</th>
                      <td>{displayValue(spec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : <p className="state">Model not found.</p>}
      </div>
    </main>
  );
}
