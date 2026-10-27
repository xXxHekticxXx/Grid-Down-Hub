#!/usr/bin/env python3
"""Convert a public-domain manual PDF into native, searchable chapters.

Output: <out>/book.json  (chapters -> blocks) and <out>/fig/*.webp (figures and tables
rendered from the page, so nothing is lost), plus plain text for every block for search.

usage: convert_manual.py <pdf> <out_dir> <book_id> <header_px> <footer_px>
"""
import json, re, sys, os, html
import pymupdf as fitz

pdf, out, book_id = sys.argv[1], sys.argv[2], sys.argv[3]
HEADER = float(sys.argv[4]) if len(sys.argv) > 4 else 55
FOOTER = float(sys.argv[5]) if len(sys.argv) > 5 else 60
H2MIN = float(sys.argv[6]) if len(sys.argv) > 6 else 11.5   # font size that makes a top-level heading
BIGHEAD = float(sys.argv[7]) if len(sys.argv) > 7 else 99   # non-bold text this large is also a heading
os.makedirs(os.path.join(out, "fig"), exist_ok=True)
doc = fitz.open(pdf)
toc = doc.get_toc()

PARA_NUM = re.compile(r"^((?:[A-Z]|[A-Z]?\d{1,2})-\d{1,3})\.\s*")
CAPTION = re.compile(r"^(Figure|Table)\s+([A-Z]?\d{1,2}-\d{1,3}|\d+)\.?", re.I)
BULLET_GLYPHS = {"x", "•", "", "•", "▪", "o", "", "-", "–"}


def clean(s):
    s = s.replace("­", "").replace("ﬁ", "fi").replace("ﬂ", "fl")
    s = s.replace("’", "’").replace("", "•")
    return re.sub(r"[ \t]+", " ", s).strip()


def overlaps(a, b, pad=2):
    return not (a[2] < b[0] - pad or a[0] > b[2] + pad or a[3] < b[1] - pad or a[1] > b[3] + pad)


def render(page, rect, name, zoom=2.2):
    r = fitz.Rect(rect) & page.rect
    if r.is_empty or r.width < 8 or r.height < 8:
        return None
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=r, alpha=False)
    path = os.path.join(out, "fig", name + ".png")
    pix.save(path)
    from PIL import Image
    im = Image.open(path)
    webp = path[:-4] + ".webp"
    im.save(webp, "WEBP", quality=78, method=6)
    os.remove(path)
    return "fig/" + os.path.basename(webp), round(r.width * zoom), round(r.height * zoom)


def words_in(page, rect):
    ws = [w for w in page.get_text("words") if overlaps(w[:4], rect, 0)]
    ws.sort(key=lambda w: (round(w[1] / 3), w[0]))
    return clean(" ".join(w[4] for w in ws))


# chapter starts from the PDF outline (level 1)
starts = [(t, p - 1) for lvl, t, p in toc if lvl == 1]
skip_titles = re.compile(r"^(Cover|Contents|Table of Contents|Index)$", re.I)
chapters = []
for i, (title, p0) in enumerate(starts):
    p1 = starts[i + 1][1] if i + 1 < len(starts) else doc.page_count
    chapters.append({"title": clean(title), "p0": p0, "p1": p1})

book = {"id": book_id, "title": doc.metadata.get("title") or book_id, "pages": doc.page_count, "chapters": []}
fig_count = 0

for ci, ch in enumerate(chapters):
    if skip_titles.match(ch["title"]):
        continue
    blocks = []  # {"t": "h2|h3|h4|p|li|fig|table", "text":..., "html":..., "src":..., "page": n}
    cur = None

    def flush():
        global cur
        if cur and cur["text"].strip():
            blocks.append(cur)
        cur = None

    for pn in range(ch["p0"], ch["p1"]):
        page = doc[pn]
        H = page.rect.height
        top, bottom = HEADER, H - FOOTER
        # excluded regions: tables and figures become images
        regions = []
        # pages where PyMuPDF's table finder crashes are listed in NOTABLES (0-based)
        try:
            no_tables = {int(x) for x in os.environ.get("NOTABLES", "").split(",") if x}
            for tb in ([] if pn in no_tables else page.find_tables().tables):
                if tb.row_count >= 2 and tb.col_count >= 2:
                    regions.append(("table", fitz.Rect(tb.bbox)))
        except Exception:
            pass
        for im in page.get_image_info():
            r = fitz.Rect(im["bbox"])
            if r.width > 40 and r.height > 30 and r.y1 > top and r.y0 < bottom:
                if not any(overlaps(r, g[1]) for g in regions):
                    regions.append(("fig", r))
        # merge figure rects that touch
        merged = []
        for kind, r in sorted(regions, key=lambda g: g[1].y0):
            if merged and kind == "fig" and merged[-1][0] == "fig" and overlaps(merged[-1][1], r, 12):
                merged[-1] = ("fig", merged[-1][1] | r)
            else:
                merged.append((kind, r))
        regions = merged

        d = page.get_text("dict")
        lines = []
        for b in d["blocks"]:
            if b["type"] != 0:
                continue
            for l in b["lines"]:
                bb = fitz.Rect(l["bbox"])
                if bb.y1 < top or bb.y0 > bottom:
                    continue
                spans = [s for s in l["spans"] if s["text"].strip()]
                if not spans:
                    continue
                # some PDFs report oversized line boxes; rebuild the box from the text baseline
                sz = max(s["size"] for s in spans)
                base = spans[0]["origin"][1]
                bb = fitz.Rect(bb.x0, base - sz * 0.8, bb.x1, base + sz * 0.22)
                if bb.y1 < top or bb.y0 > bottom:
                    continue
                text = clean("".join(s["text"] for s in l["spans"]))
                if not text:
                    continue
                in_region = None
                for k, (kind, r) in enumerate(regions):
                    if overlaps(bb, r, 1) and bb.y0 >= r.y0 - 1 and bb.y1 <= r.y1 + 1:
                        in_region = k
                lines.append({
                    "bb": bb, "text": text, "region": in_region,
                    "size": max(s["size"] for s in spans),
                    "bold": all(s["flags"] & 16 or "Bold" in s["font"] for s in spans),
                    "italic": all(s["flags"] & 2 or "Italic" in s["font"] or "It" in s["font"][-3:] for s in spans),
                    "first": spans[0]["text"].strip(), "firstfont": spans[0]["font"],
                })
        # group fragments that sit on the same visual row (bullet glyph + text, split spans)
        lines.sort(key=lambda L: ((L["bb"].y0 + L["bb"].y1) / 2, L["bb"].x0))
        groups = []
        for L in lines:
            cy = (L["bb"].y0 + L["bb"].y1) / 2
            g = groups[-1] if groups else None
            # same row: vertical centers within 3.5pt and the fragments do not overlap horizontally
            tol = 6.5 if (len(L["text"]) <= 2 or len(g[0]["text"]) <= 2 if g else False) else 3.5
            if g and g[0]["region"] == L["region"] and abs(g[0]["cy"] - cy) < tol and \
                    all(L["bb"].x0 >= m["bb"].x1 - 1 or L["bb"].x1 <= m["bb"].x0 + 1 for m in g) and \
                    min(max(L["bb"].x0 - m["bb"].x1, m["bb"].x0 - L["bb"].x1) for m in g) < 22:
                g.append(L)
                continue
            L["cy"] = cy
            groups.append([L])
        rows = []
        for g in groups:
            g.sort(key=lambda m: m["bb"].x0)
            R = dict(g[0])
            for m in g[1:]:
                R["text"] = clean(R["text"] + " " + m["text"])
                R["bb"] = R["bb"] | m["bb"]
                R["bold"] = R["bold"] and m["bold"]
                R["size"] = max(R["size"], m["size"])
            rows.append(R)
        lines = rows
        # column-aware reading order: split the page into bands at full-width lines;
        # inside a band read the left column top to bottom, then the right column
        W = page.rect.width
        mid = W / 2
        body = [L for L in lines if L["region"] is None]
        best = None
        for x in range(int(W * 0.25), int(W * 0.75), 3):
            cross = sum(1 for L in body if L["bb"].x0 < x - 3 and L["bb"].x1 > x + 3)
            left = sum(1 for L in body if L["bb"].x1 <= x + 3)
            right = sum(1 for L in body if L["bb"].x0 >= x - 3)
            if left >= 4 and right >= 4 and (best is None or cross < best[0]):
                best = (cross, x)
        if best and best[0] <= max(3, len(body) // 12):
            mid = best[1]

        def col(L):
            if L["bb"].width > 0.6 * W:
                return -1  # spans both columns
            return 0 if (L["bb"].x0 + L["bb"].x1) / 2 < mid else 1
        lines.sort(key=lambda L: (L["bb"].y0, L["bb"].x0))
        two_col = sum(1 for L in lines if col(L) == 1) >= 4 and sum(1 for L in lines if col(L) == 0) >= 4
        if two_col:
            ordered, band = [], []

            def dump(band):
                band.sort(key=lambda L: (max(col(L), 0), L["bb"].y0, L["bb"].x0))
                return band
            for L in lines:
                if col(L) == -1:
                    ordered += dump(band)
                    band = []
                    ordered.append(L)
                else:
                    band.append(L)
            ordered += dump(band)
            for k, L in enumerate(ordered):
                L["order"] = k
            lines = ordered
        else:
            for k, L in enumerate(lines):
                L["order"] = k
        # captions attach to regions: a caption line just above/below a region
        events = []
        used_regions = set()
        for L in lines:
            if L["region"] is not None:
                continue
            events.append(("line", L["order"], L))
        # a region goes right before the first line (in reading order) that sits below it in its column
        for k, (kind, r) in enumerate(regions):
            pos = len(lines) + 0.5
            for L in lines:
                if L["region"] is None and L["bb"].y0 >= r.y0 - 2 and (abs(L["bb"].x0 - r.x0) < W / 2):
                    pos = L["order"] - 0.5
                    break
            events.append(("region", pos, k))
        events.sort(key=lambda e: e[1])

        prev_y1 = None
        for ev in events:
            if ev[0] == "region":
                k = ev[2]
                kind, r = regions[k]
                flush()
                fig_count += 1
                res = render(page, r, f"{book_id}-{pn+1:03d}-{fig_count:04d}")
                if res:
                    src, w, h = res
                    blocks.append({"t": "table" if kind == "table" else "fig", "src": src, "w": w, "h": h,
                                   "text": words_in(page, r), "page": pn + 1})
                prev_y1 = r.y1
                continue
            L = ev[2]
            t = L["text"]
            gap = (L["bb"].y0 - prev_y1) if prev_y1 is not None else 99
            if gap < -40:  # jumped to the top of the next column
                gap = 99 if not (cur and cur["t"] in ("p", "li")) else 0
            prev_y1 = L["bb"].y1
            cap = CAPTION.match(t)
            if cap and L["bold"]:
                flush()
                blocks.append({"t": "cap", "text": t, "page": pn + 1})
                continue
            is_heading = ((L["bold"] and len(t) < 110) or L["size"] >= BIGHEAD) and not PARA_NUM.match(t)
            # bold words inside a running paragraph are emphasis, not a heading
            if is_heading and L["size"] < H2MIN and cur and cur["t"] in ("p", "li") and gap < L["size"] * 0.5 \
                    and not cur["text"].rstrip().endswith((".", ":", "?", "!")):
                cur["text"] += " " + t
                continue
            if is_heading:
                lvl = "h2" if L["size"] >= H2MIN else ("h4" if L["italic"] else "h3")
                # a heading split over two lines with a stray fragment between them
                if lvl == "h2" and not cur and blocks and blocks[-1]["t"] == "h2" and blocks[-1]["page"] == pn + 1 \
                        and not blocks[-1]["text"].endswith((".", ":")) and len(blocks[-1]["text"]) < 40:
                    cur = blocks.pop()
                    cur["text"] += " " + t
                    continue
                # continuation of a multi-line heading
                if cur and cur["t"] == lvl and gap < L["size"] * 0.6:
                    cur["text"] += " " + t
                    continue
                flush()
                cur = {"t": lvl, "text": t, "page": pn + 1}
                continue
            m = PARA_NUM.match(t)
            bullet = (L["first"] in BULLET_GLYPHS or len(L["first"]) == 1) and (
                "Symbol" in L["firstfont"] or "Wingding" in L["firstfont"] or L["first"] in "•▪")
            if m:
                flush()
                cur = {"t": "p", "num": m.group(1), "text": t[m.end():], "page": pn + 1}
                continue
            if bullet:
                flush()
                body = t[len(L["first"]):].strip()
                cur = {"t": "li", "text": body, "page": pn + 1}
                continue
            if cur and cur["t"] in ("p", "li") and gap < L["size"] * 0.9:
                # join hyphenated words across lines
                if cur["text"].endswith("-") and not cur["text"].endswith(" -"):
                    cur["text"] = cur["text"][:-1] + t
                else:
                    cur["text"] += " " + t
                continue
            # first line on a new page continuing the previous page's paragraph
            if cur is None and blocks and blocks[-1]["t"] in ("p", "li") and blocks[-1]["page"] == pn and \
                    gap == 99 and (t[:1].islower() or not blocks[-1]["text"].rstrip().endswith((".", ":", "—", "?", "!"))):
                cur = blocks.pop()
                cur["text"] = (cur["text"][:-1] + t) if cur["text"].endswith("-") else cur["text"] + " " + t
                continue
            flush()
            cur = {"t": "p", "text": t, "page": pn + 1}
        # keep an open paragraph open across the page break; it is flushed by the next block
        if cur is not None:
            flush()
    # attach captions to the nearest figure/table and drop page furniture
    out_blocks = []
    for b in blocks:
        if b["t"] == "cap":
            # a caption belongs to the figure directly before or after it
            if out_blocks and out_blocks[-1]["t"] in ("fig", "table") and not out_blocks[-1].get("caption"):
                out_blocks[-1]["caption"] = b["text"]
                continue
            b["t"] = "pendingcap"
        if b["t"] in ("fig", "table") and out_blocks and out_blocks[-1]["t"] == "pendingcap":
            b["caption"] = out_blocks.pop()["text"]
        out_blocks.append(b)
    for b in out_blocks:
        if b["t"] == "pendingcap":
            b["t"] = "h4"
        b["text"] = clean(b["text"])
    # WARNING / CAUTION / NOTE headings followed by bold text become callout boxes
    fixed = []
    for b in out_blocks:
        if fixed and fixed[-1]["t"] == "warn" and fixed[-1]["text"] == "" and b["t"] in ("h3", "h4", "p"):
            fixed[-1]["text"] = b["text"]
            continue
        if b["t"] in ("h2", "h3") and b["text"].strip().upper().rstrip(":") in ("WARNING", "CAUTION", "NOTE", "DANGER"):
            fixed.append({"t": "warn", "label": b["text"].strip().upper().rstrip(":"), "text": "", "page": b["page"]})
            continue
        fixed.append(b)
    out_blocks = [b for b in fixed if not (b["t"] == "warn" and not b["text"])]
    book["chapters"].append({"id": f"{book_id}-ch{ci:02d}", "title": ch["title"],
                             "pageStart": ch["p0"] + 1, "pageEnd": ch["p1"], "blocks": out_blocks})

with open(os.path.join(out, "book.json"), "w") as f:
    json.dump(book, f, ensure_ascii=False)
n_blocks = sum(len(c["blocks"]) for c in book["chapters"])
n_fig = sum(1 for c in book["chapters"] for b in c["blocks"] if b["t"] in ("fig", "table"))
n_chars = sum(len(b["text"]) for c in book["chapters"] for b in c["blocks"])
print(f"{book_id}: {len(book['chapters'])} chapters, {n_blocks} blocks, {n_fig} figures/tables, {n_chars} chars")
