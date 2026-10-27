#!/usr/bin/env python3
"""Write content/library.json and content/library-text/*.json (searchable page text).

usage: make_library.py <pdf_dir> <repo_root>
<pdf_dir> holds the reference PDFs and the USGS US Topo GeoPDFs (FL_<Name>_<date>_TM_geo.pdf).
Home-area quads are shipped as the original GeoPDFs; forest quads as print editions (see make_print_editions.sh).
"""
import json, os, re, sys, subprocess
import pymupdf

pdf_dir, repo = sys.argv[1], sys.argv[2]
HOME_QUADS = {"Sorrento", "Umatilla", "Paisley", "Pine Lakes", "Eustis", "Sanford SW", "Astatula", "Apopka", "Forest City"}
CHECKED = "2026-10-27"


def bbox_of(pdf):
    """Geographic bounds of a GeoPDF's neatline, via GDAL."""
    out = subprocess.run(["gdalinfo", "-json", pdf], capture_output=True, text=True).stdout
    j = json.loads(out)
    ring = j.get("wgs84Extent", {}).get("coordinates", [[]])[0]
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    return [round(min(xs), 4), round(min(ys), 4), round(max(xs), 4), round(max(ys), 4)]


def page_text(pdf, limit=None):
    d = pymupdf.open(pdf)
    pages = []
    for i, p in enumerate(d):
        if limit and i >= limit:
            break
        pages.append(re.sub(r"\s+", " ", p.get_text()).strip())
    return pages


docs = [
    {"id": "atp-3-50-21", "title": "ATP 3-50.21 Survival (U.S. Army, 2018)", "kind": "book", "pack": "library", "file": "ATP_3-50.21_Survival.pdf",
     "bookId": "atp", "note": "Approved for public release; distribution unlimited. Read it as native chapters or open the original PDF.",
     "source": {"title": "Army Publishing Directorate", "url": "https://armypubs.army.mil/epubs/DR_pubs/DR_a/pdf/web/ARN12086_ATP%203-50x21%20FINAL%20WEB%202.pdf", "checked": CHECKED}},
    {"id": "fema-p-2064", "title": "Are You Ready? An In-Depth Guide to Citizen Preparedness (FEMA P-2064)", "kind": "book", "pack": "library", "file": "FEMA_P-2064_Are_You_Ready.pdf",
     "bookId": "fema", "note": "FEMA public guide. Read it as native chapters or open the original PDF.",
     "source": {"title": "Ready.gov", "url": "https://www.ready.gov/sites/default/files/2021-11/are-you-ready-guide.pdf", "checked": CHECKED}},
    {"id": "atp-4-02-11", "title": "ATP 4-02.11 Casualty Response, Tactical Combat Casualty Care, and First Aid (U.S. Army, 2026)", "kind": "reference", "pack": "library",
     "file": "ATP_4-02.11_Casualty_Response_First_Aid.pdf",
     "note": "Army reference (2026); civilian guidance in the First Aid tab takes priority. Supersedes TC 4-02.1 (2016). Approved for public release; distribution unlimited.",
     "source": {"title": "Army Publishing Directorate", "url": "https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN46159-ATP_4-02.11-000-WEB-1.pdf", "checked": CHECKED}},
]
texts = {"atp-4-02-11": ("ATP 4-02.11", page_text(os.path.join(pdf_dir, "ATP_4-02.11_Casualty_Response_First_Aid.pdf")))}

for f in sorted(os.listdir(pdf_dir)):
    m = re.match(r"FL_(.+)_(\d{8})_TM_geo\.pdf$", f)
    if not m:
        continue
    name = m.group(1).replace("_", " ")
    date = f"{m.group(2)[:4]}-{m.group(2)[4:6]}-{m.group(2)[6:]}"
    home = name in HOME_QUADS
    qid = "topo-" + m.group(1).lower().replace("_", "-")
    docs.append({
        "id": qid, "title": f"USGS US Topo: {name}, FL ({date[:4]})", "kind": "topo",
        "pack": "topo-pdf-home" if home else "topo-pdf-forest",
        "file": f if home else f.replace("_TM_geo.pdf", "_print.pdf"),
        "note": ("Original USGS GeoPDF (public domain). Print at 100% on 22x27 in or scale to fit."
                 if home else "Print edition made from the USGS GeoPDF: map frame only, no aerial photo layer, georeferenced. Public domain."),
        "date": date, "bbox": bbox_of(os.path.join(pdf_dir, f)),
        "source": {"title": "USGS The National Map, US Topo", "url": f"https://prd-tnm.s3.amazonaws.com/StagedProducts/Maps/USTopo/PDF/FL/{f}", "checked": CHECKED},
    })
    # map labels (lakes, roads, springs, landmarks) make the quads searchable by place name
    words = re.findall(r"[A-Za-z][A-Za-z'.-]{2,}", " ".join(page_text(os.path.join(pdf_dir, f), 1)))
    seen, keep = set(), []
    for w in words:
        if w.lower() not in seen:
            seen.add(w.lower()); keep.append(w)
    texts[qid] = (f"Topo {name}", [" ".join(keep)])

os.makedirs(os.path.join(repo, "content", "library-text"), exist_ok=True)
for qid, (title, pages) in texts.items():
    with open(os.path.join(repo, "content", "library-text", f"{qid}.json"), "w") as fh:
        json.dump({"id": qid, "title": title, "pages": pages}, fh, ensure_ascii=False)
with open(os.path.join(repo, "content", "library.json"), "w") as fh:
    json.dump(docs, fh, indent=1, ensure_ascii=False)
print(len(docs), "library docs;", sum(len(p) for _, p in texts.values()), "text pages")
