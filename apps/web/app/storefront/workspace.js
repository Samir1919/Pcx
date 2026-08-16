"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { storefrontApi } from "../../lib/storefront-api";

const sorts = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" }
];

function money(value) {
  if (value == null) return "Price on request";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>;
}

export default function StorefrontWorkspace() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [listings, setListings] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [cursor, setCursor] = useState(null);

  const load = useCallback(async (next) => {
    setLoading(true);
    try {
      const result = await storefrontApi.listings({ categoryId, brandId, q, sort, cursor: next ?? null, limit: 12 });
      setListings(result.data);
      setNextCursor(result.meta?.nextCursor ?? null);
      setCursor(next ?? null);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [categoryId, brandId, q, sort]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cats, brs] = await Promise.all([storefrontApi.categories(), storefrontApi.brands()]);
        if (!active) return;
        setCategories(cats.data);
        setBrands(brs.data);
      } catch (error) {
        if (active) setNotice({ kind: "error", message: error.message });
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => { load(null); }, [load]);

  const names = useMemo(() => ({
    category: Object.fromEntries(categories.map((r) => [r.id, r.name])),
    brand: Object.fromEntries(brands.map((r) => [r.id, r.name]))
  }), [categories, brands]);

  function applyFilters(event) {
    event.preventDefault();
    load(null);
  }

  return (
    <main>
      <div className="topbar">
        <div className="topbarInner">
          <a className="brand" href="/storefront" aria-label="PCX Storefront home"><b>PCX</b><small>CERTIFIED PRE-OWNED</small></a>
          <nav aria-label="Primary"><a className="selected" href="/storefront">Storefront</a><a href="/catalog">Catalog</a></nav>
        </div>
      </div>
      <div className="wrap">
        <div className="hero">
          <p className="eyebrow">CERTIFIED PRE-OWNED MARKETPLACE</p>
          <h1>Shop verified hardware</h1>
          <p>Every listing is inspected, graded, and backed by a public passport. Prices are set by PCX — never by the seller.</p>
        </div>
        <Banner notice={notice} onClose={() => setNotice(null)} />
        <form className="filters" onSubmit={applyFilters}>
          <label><span>Search</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. GPU, laptop…" maxLength="100" /></label>
          <label><span>Category</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label><span>Brand</span><select value={brandId} onChange={(e) => setBrandId(e.target.value)}><option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label><span>Sort</span><select value={sort} onChange={(e) => setSort(e.target.value)}>{sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          <button className="primary" type="submit" disabled={loading}>Apply</button>
        </form>
        {loading ? <p className="state" role="status">Loading listings…</p> : listings.length === 0 ? <p className="state">No published listings match your filters.</p> : (
          <>
            <div className="grid">
              {listings.map((item) => (
                <a key={item.id} className="card" href={`/passport/${encodeURIComponent(item.pcxItemId)}`}>
                  <span className="pill">Certified</span>
                  <h3>{item.name}</h3>
                  <div className="meta">{names.brand[item.brandId] ?? "Unknown brand"} · {names.category[item.categoryId] ?? "Unknown category"}</div>
                  <div className="price">{money(item.price)}<small>PCX-set price · passport verified</small></div>
                </a>
              ))}
            </div>
            <div className="pager">
              <button type="button" disabled={!cursor || loading} onClick={() => load(null)}>← First</button>
              <button type="button" disabled={!nextCursor || loading} onClick={() => load(nextCursor)}>Next →</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
