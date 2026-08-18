"use client";
import { useEffect, useMemo, useState } from "react";
import { storefrontApi } from "../../lib/storefront-api";
import StorefrontNav from "../StorefrontNav";
import ListingCard from "../listing/ListingCard";

const WHY_PCX = [
  { icon: "🔍", title: "Certified inspection", text: "Every item is physically checked and graded by PCX before it is listed." },
  { icon: "🏷️", title: "Transparent grading", text: "You see the condition grade and health score before you decide." },
  { icon: "🛂", title: "Public passport", text: "A verified condition report travels with each item — no hidden history." },
  { icon: "💰", title: "PCX-set price", text: "Sellers never set the price, so you always trade on PCX's honest valuation." }
];

const HOW_BUY = [
  { step: "1", title: "Browse", text: "Find a certified item that fits your needs." },
  { step: "2", title: "Review passport", text: "Check its grade, health score, and inspection checks." },
  { step: "3", title: "Secure checkout", text: "Reserve and pay through a verified flow." }
];

const HOW_SELL = [
  { step: "1", title: "Request a quote", text: "Tell PCX what you have and get an estimated range." },
  { step: "2", title: "Physical inspection", text: "PCX verifies the item before any final offer." },
  { step: "3", title: "Transparent offer", text: "Receive a clear offer — no final price until inspected." }
];

const CATEGORY_ICONS = {
  "gpu": "🎮",
  "cpu": "🧠",
  "motherboard": "🔲",
  "ram": "🧩",
  "storage": "💾",
  "psu": "🔌",
  "desktop-pc": "🖥️",
  "pc-parts": "🔧",
  "laptop": "💻",
  "laptop-parts": "🔩",
  "monitor": "🖥️",
  "accessory": "⌨️",
  "battery": "🔋",
  "keyboard": "⌨️",
  "charger": "🔌",
  "screen": "🖥️"
};

function categoryIcon(category) {
  return CATEGORY_ICONS[category.slug] ?? CATEGORY_ICONS[category.name?.toLowerCase()] ?? "📦";
}

export default function HomeWorkspace() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [latest, setLatest] = useState([]);
  const [loadingLatest, setLoadingLatest] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cats, brs, list] = await Promise.all([
          storefrontApi.categories(),
          storefrontApi.brands(),
          storefrontApi.listings({ sort: "newest", limit: 8 })
        ]);
        if (!active) return;
        setCategories(cats.data);
        setBrands(brs.data);
        setLatest(list.data ?? []);
      } catch {
        if (active) {
          setCategories([]);
          setBrands([]);
          setLatest([]);
        }
      } finally {
        if (active) setLoadingLatest(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const names = useMemo(() => ({
    category: Object.fromEntries(categories.map((r) => [r.id, r.name])),
    brand: Object.fromEntries(brands.map((r) => [r.id, r.name]))
  }), [categories, brands]);

  const rootCategories = useMemo(
    () => categories.filter((c) => !c.parentId).slice(0, 8),
    [categories]
  );

  return (
    <main>
      <StorefrontNav />
      <div className="wrap">
        <a className="sellBanner" href="/sell">
          <span className="sellBannerCopy">
            <span className="eyebrow">SELL TO PCX</span>
            <span className="sellBannerTitle">Have hardware? Turn it into cash.</span>
            <span className="sellBannerText">Get an estimated range now — the final offer is confirmed only after physical inspection.</span>
            <span className="sellBannerCta">Get a quote →</span>
            <span className="sellBannerTrust">Certified inspection · Honest grading · Transparent quote</span>
          </span>
          <span className="sellBannerArt" aria-hidden="true">💻🖥️🔧</span>
        </a>

        <section className="whyPcx" aria-label="Why PCX">
          <div className="sectionHeading">
            <p className="eyebrow">WHY PCX</p>
            <h2>Buy pre-owned with confidence</h2>
          </div>
          <div className="whyGrid">
            {WHY_PCX.map((w) => (
              <div key={w.title} className="whyItem">
                <span className="whyIcon" aria-hidden="true">{w.icon}</span>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="latest" aria-label="Latest listings">
          <div className="sectionHeading latestHeading">
            <div>
              <p className="eyebrow">FRESH IN</p>
              <h2>Latest certified hardware</h2>
            </div>
            <a className="viewAll" href="/storefront">View all →</a>
          </div>
          {loadingLatest ? (
            <p className="state" role="status">Loading latest listings…</p>
          ) : latest.length === 0 ? (
            <p className="state">No published listings yet — check back soon.</p>
          ) : (
            <div className="grid">
              {latest.map((item) => (
                <ListingCard key={item.id} item={item} brandName={names.brand[item.brandId]} categoryName={names.category[item.categoryId]} />
              ))}
            </div>
          )}
        </section>

        <section className="howItWorks" aria-label="How it works">
          <div className="sectionHeading">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>Simple on both sides</h2>
          </div>
          <div className="howGrid">
            <div className="howCol">
              <h3>Buying</h3>
              <ol>
                {HOW_BUY.map((s) => <li key={s.step}><span className="step">{s.step}</span><div><strong>{s.title}</strong><p>{s.text}</p></div></li>)}
              </ol>
              <a className="howCta" href="/storefront">Browse hardware</a>
            </div>
            <div className="howCol">
              <h3>Selling</h3>
              <ol>
                {HOW_SELL.map((s) => <li key={s.step}><span className="step">{s.step}</span><div><strong>{s.title}</strong><p>{s.text}</p></div></li>)}
              </ol>
              <a className="howCta" href="/sell">Get a quote</a>
            </div>
          </div>
        </section>

        {rootCategories.length > 0 && (
          <section className="categories" aria-label="Browse categories">
            <div className="sectionHeading">
              <p className="eyebrow">BROWSE CATEGORIES</p>
              <h2>Shop by category</h2>
            </div>
            <div className="categoryGrid">
              {rootCategories.map((c) => (
                <a key={c.id} className="categoryTile" href={`/storefront?category=${encodeURIComponent(c.id)}`}>
                  <span className="categoryIcon" aria-hidden="true">{categoryIcon(c)}</span>
                  <span className="categoryName">{c.name}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
