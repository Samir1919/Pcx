"use client";
import { money } from "../../lib/format";
import PassportInfoModal from "../passport/PassportInfoModal";

export default function ListingCard({ item, brandName, categoryName }) {
  return (
    <a className="card" href={`/passport/${encodeURIComponent(item.pcxItemId)}`}>
      <span className="pill">Certified</span>
      <h3>{item.name}</h3>
      <div className="meta">{brandName ?? "Unknown brand"} · {categoryName ?? "Unknown category"}</div>
      <div className="price">{money(item.price)}<small>PCX-set price · <PassportInfoModal triggerAs="span" triggerLabel="passport verified" triggerClassName="passport-verified-trigger" /></small></div>
    </a>
  );
}
