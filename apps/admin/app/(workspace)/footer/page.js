"use client";

import { useCallback, useEffect, useState } from "react";
import { siteFooterApi } from "../../../lib/site-footer-api.js";

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }
function Field({ label, name, ...props }) { return <label><span>{label}</span><input name={name} {...props} /></label>; }

const SOCIAL_PLATFORMS = ["facebook", "instagram", "youtube", "linkedin", "x", "whatsapp"];

const emptyFooter = () => ({
  tagline: "",
  copyright: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  tradeLicense: "",
  bin: "",
  socialLinks: [],
  linkColumns: []
});

export default function FooterPage() {
  const [form, setForm] = useState(emptyFooter());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await siteFooterApi.get();
      const data = payload.data ?? emptyFooter();
      setForm({
        tagline: data.tagline ?? "",
        copyright: data.copyright ?? "",
        contactEmail: data.contactEmail ?? "",
        contactPhone: data.contactPhone ?? "",
        address: data.address ?? "",
        tradeLicense: data.tradeLicense ?? "",
        bin: data.bin ?? "",
        socialLinks: data.socialLinks ?? [],
        linkColumns: data.linkColumns ?? []
      });
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to manage the site footer." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(key, value) { setForm((prev) => ({ ...prev, [key]: value })); }

  function addSocial() { setForm((prev) => ({ ...prev, socialLinks: [...prev.socialLinks, { platform: "facebook", href: "" }] })); }
  function setSocial(index, key, value) {
    setForm((prev) => ({ ...prev, socialLinks: prev.socialLinks.map((s, i) => (i === index ? { ...s, [key]: value } : s)) }));
  }
  function removeSocial(index) { setForm((prev) => ({ ...prev, socialLinks: prev.socialLinks.filter((_, i) => i !== index) })); }

  function addColumn() { setForm((prev) => ({ ...prev, linkColumns: [...prev.linkColumns, { title: "", links: [] }] })); }
  function setColumnTitle(index, value) { setForm((prev) => ({ ...prev, linkColumns: prev.linkColumns.map((c, i) => (i === index ? { ...c, title: value } : c)) })); }
  function removeColumn(index) { setForm((prev) => ({ ...prev, linkColumns: prev.linkColumns.filter((_, i) => i !== index) })); }
  function addLink(columnIndex) {
    setForm((prev) => ({ ...prev, linkColumns: prev.linkColumns.map((c, i) => (i === columnIndex ? { ...c, links: [...c.links, { label: "", href: "/" }] } : c)) }));
  }
  function setLink(columnIndex, linkIndex, key, value) {
    setForm((prev) => ({ ...prev, linkColumns: prev.linkColumns.map((c, i) => (i === columnIndex ? { ...c, links: c.links.map((l, j) => (j === linkIndex ? { ...l, [key]: value } : l)) } : c)) }));
  }
  function removeLink(columnIndex, linkIndex) {
    setForm((prev) => ({ ...prev, linkColumns: prev.linkColumns.map((c, i) => (i === columnIndex ? { ...c, links: c.links.filter((_, j) => j !== linkIndex) } : c)) }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await siteFooterApi.save(form);
      setNotice({ kind: "success", message: "Site footer saved." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="state" role="status">Loading footer…</p>;

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / FOOTER</p>
          <h1>Site footer</h1>
          <p>Manage the public storefront footer. Content is presentation-only; hrefs must be internal (start with "/").</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />

      <form onSubmit={save} className="grid">
        <section className="panel formPanel">
          <p className="eyebrow">BRAND & CONTACT</p>
          <h2>Company details</h2>
          <Field label="Tagline" name="tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength="240" />
          <Field label="Copyright line" name="copyright" value={form.copyright} onChange={(e) => set("copyright", e.target.value)} maxLength="240" />
          <Field label="Contact email" name="contactEmail" type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} maxLength="200" />
          <Field label="Contact phone" name="contactPhone" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} maxLength="40" />
          <Field label="Address" name="address" value={form.address} onChange={(e) => set("address", e.target.value)} maxLength="500" />
          <Field label="Trade license" name="tradeLicense" value={form.tradeLicense} onChange={(e) => set("tradeLicense", e.target.value)} maxLength="120" />
          <Field label="BIN" name="bin" value={form.bin} onChange={(e) => set("bin", e.target.value)} maxLength="120" />
        </section>

        <section className="panel formPanel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">SOCIAL</p>
              <h2>Follow us</h2>
            </div>
            <button className="refresh" type="button" onClick={addSocial}>+ Add</button>
          </div>
          {form.socialLinks.length === 0 ? <p className="state">No social links.</p> : (
            <div className="stack">
              {form.socialLinks.map((s, i) => (
                <div key={i} className="rowFields">
                  <label><span>Platform</span>
                    <select value={s.platform} onChange={(e) => setSocial(i, "platform", e.target.value)}>
                      {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <Field label="URL" name={`social-${i}`} type="url" value={s.href} onChange={(e) => setSocial(i, "href", e.target.value)} />
                  <button className="danger" type="button" onClick={() => removeSocial(i)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel formPanel spread">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">LINK COLUMNS</p>
              <h2>Footer links</h2>
            </div>
            <button className="refresh" type="button" onClick={addColumn}>+ Column</button>
          </div>
          {form.linkColumns.length === 0 ? <p className="state">No link columns.</p> : (
            <div className="stack">
              {form.linkColumns.map((c, ci) => (
                <div key={ci} className="columnEditor">
                  <div className="rowFields">
                    <Field label="Column title" name={`col-${ci}-title`} value={c.title} onChange={(e) => setColumnTitle(ci, e.target.value)} maxLength="80" />
                    <button className="danger" type="button" onClick={() => removeColumn(ci)}>Remove column</button>
                  </div>
                  {c.links.map((l, li) => (
                    <div key={li} className="rowFields">
                      <Field label="Label" name={`col-${ci}-label-${li}`} value={l.label} onChange={(e) => setLink(ci, li, "label", e.target.value)} maxLength="80" />
                      <Field label="Href" name={`col-${ci}-href-${li}`} value={l.href} onChange={(e) => setLink(ci, li, "href", e.target.value)} maxLength="600" />
                      <button className="danger" type="button" onClick={() => removeLink(ci, li)}>Remove</button>
                    </div>
                  ))}
                  <button className="refresh" type="button" onClick={() => addLink(ci)}>+ Link</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="formActions">
          <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save footer"}</button>
        </div>
      </form>
    </>
  );
}
