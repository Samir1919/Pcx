"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { storefrontApi } from "../../lib/storefront-api";
import PassportInfoModal from "../passport/PassportInfoModal";
import StorefrontNav from "../StorefrontNav";
import ListingCard from "../listing/ListingCard";

const sorts = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" }
];

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>;
}

function initialCategory() {
  if (typeof window === "undefined") return "";
  try {
    return new URLSearchParams(window.location.search).get("category") ?? "";
  } catch {
    return "";
  }
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
  const [hydrated, setHydrated] = useState(false);
  const [facets, setFacets] = useState([]);
  const [specFilters, setSpecFilters] = useState({});

  // Apply the deep-linked category once, on the client, before the first load.
  useEffect(() => {
    const linked = initialCategory();
    if (linked) setCategoryId(linked);
    setHydrated(true);
  }, []);

  const load = useCallback(async (next) => {
    setLoading(true);
    try {
      const specs = Object.entries(specFilters).filter(([, value]) => value).map(([key, value]) => ({ key, value }));
      const result = await storefrontApi.listings({ categoryId, brandId, q, sort, cursor: next ?? null, limit: 12, specs });
      setListings(result.data);
      setNextCursor(result.meta?.nextCursor ?? null);
      setCursor(next ?? null);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [categoryId, brandId, q, sort, specFilters]);

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

  // Load filterable-attribute facets for the chosen category (layered navigation).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await storefrontApi.listingFacets({ categoryId: categoryId || undefined });
        if (active) setFacets(result.data ?? []);
      } catch {
        if (active) setFacets([]);
      }
    })();
    return () => { active = false; };
  }, [categoryId]);

  useEffect(() => {
    if (!hydrated) return;
    load(null);
  }, [hydrated, load]);

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
      <StorefrontNav />
      <div className="wrap">
        <section className="marketplace" aria-label="Marketplace">
          <div className="hero">
            <p className="eyebrow">CERTIFIED PRE-OWNED MARKETPLACE</p>
            <h1>Shop verified hardware</h1>
            <p>Every listing is inspected, graded, and backed by a public passport. Prices are set by PCX — never by the seller. <PassportInfoModal triggerAs="span" triggerLabel="Learn more" /></p>
          </div>
          <Banner notice={notice} onClose={() => setNotice(null)} />
          <form className="filters" onSubmit={applyFilters}>
            <label className="filterSearch">
              <span>Search</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hardware…" maxLength="100" />
            </label>
            <div className="filterRow">
              <label><span>Category</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label><span>Brand</span><select value={brandId} onChange={(e) => setBrandId(e.target.value)}><option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              <label><span>Sort</span><select value={sort} onChange={(e) => setSort(e.target.value)}>{sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
            </div>
            {facets.length > 0 && (
              <div className="filterRow facetRow">
                {facets.map((facet) => (
                  <label key={facet.key}><span>{facet.label}</span>
                    <select value={specFilters[facet.key] ?? ""} onChange={(e) => setSpecFilters((prev) => ({ ...prev, [facet.key]: e.target.value }))}>
                      <option value="">Any {facet.label.toLowerCase()}</option>
                      {facet.values.map((value) => <option key={value} value={value}>{value}{facet.unit ? ` ${facet.unit}` : ""}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <button className="primary" type="submit" disabled={loading}>Apply filters</button>
          </form>
          {loading ? <p className="state" role="status">Loading listings…</p> : listings.length === 0 ? <p className="state">No published listings match your filters.</p> : (
            <>
              <div className="grid">
                {listings.map((item) => (
                  <ListingCard key={item.id} item={item} brandName={names.brand[item.brandId]} categoryName={names.category[item.categoryId]} />
                ))}
              </div>
              <div className="pager">
                <button type="button" disabled={!cursor || loading} onClick={() => load(null)}>← First</button>
                <button type="button" disabled={!nextCursor || loading} onClick={() => load(nextCursor)}>Next →</button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
