# Survival Skills and Offline Library (verified 2026-10-26)

## Core survival skills source: Army ATP 3-50.21, *Survival* (2018)
*Source: [Army Publishing Directorate record](https://armypubs.army.mil/ProductMaps/PubForm/Details.aspx?PUB_ID=1005316) · [PDF (armypubs)](https://armypubs.army.mil/epubs/DR_pubs/DR_a/pdf/web/ARN12086_ATP%203-50x21%20FINAL%20WEB%202.pdf) · [mirror (FAS)](https://irp.fas.org/doddir/army/atp3-50-21.pdf)*

- Status: **ACTIVE**, and marked **"Approved for public release; distribution is unlimited."** It replaces the older FM 3-05.70 / FM 21-76 survival manuals. **Safe to bundle in the app.**
- Chapters to turn into app sections. Keep the original wording and add the chapter reference:

| App section | ATP 3-50.21 chapter |
| --- | --- |
| Survival basics and mindset | Ch. 1 Overview, survival proficiencies |
| Survival medicine | Ch. 2 Survival medicine applications |
| Water | Ch. 3 Water collection methods |
| Food | Ch. 4 Food collection and preparation |
| Fire | Ch. 5 Fire craft |
| Shelter and clothing | Ch. 6 Shelters and clothing |
| Navigation (no GPS) | Ch. 7 Land navigation |
| Gear | Ch. 8 Survival, evasion and recovery equipment |
| Knots | Appendix A Ropes and knots |

- **Florida context to add as notes** (Frank's notes, labeled as such): this manual is written for soldiers in the wild. For a grid-down event at home in Central Florida, water, heat, sanitation, hurricanes and CO are the bigger daily risks (see 01–03). Put those first in the menu, with wilderness skills after.
- **Wild plants:** only show plant-eating guidance with a strong warning. Don't eat any wild plant you can't identify with certainty.

## Bigger offline libraries: Kiwix (free)
*Sources: [Kiwix Server](https://get.kiwix.org/en/solutions/applications/kiwix-server/) · [Kiwix content bundles](https://get.kiwix.org/en/solutions/hotspots/content-bundles/) · [medical ZIM list](https://zim-download.medical.demo.hotspot.kiwix.org/)*

- Kiwix packs whole websites (Wikipedia, medical encyclopedias, how-to sites) into single `.zim` files that work fully offline. Kiwix apps exist for **Android, Windows, Linux and Mac**, and `kiwix-serve` shares them to any browser on the local network. It runs on a Raspberry Pi.
- Useful files and sizes seen in the current catalog (sizes change; check before downloading):

| ZIM | Size | Use |
| --- | --- | --- |
| mdwiki (WikiProjectMed medical encyclopedia) | 10.0 GB | Deep medical reference |
| MedlinePlus (US government health info) | 1.8 GB | Plain-language health topics |
| Wikipedia, medicine subset (maxi) | 2.0 GB | Medical articles |
| CDC travel health (wwwnc.cdc.gov) | 170 MB | Diseases, vaccines, water/food safety |
| WikEM (emergency medicine) | 42 MB | Emergency treatment quick reference |
| FAS military medicine | 78 MB | Field medicine manuals |
| zimgit-water | 20 MB | Water treatment |
| NHS medicines | 16 MB | Medication info |

- Kiwix also offers a curated **"Preppers"** bundle (all of Wikipedia, homesteading, water treatment, repair) and "Preppers Premium" (adds the medical bundle).
- **Simple version (no Pi):** install the Kiwix app on the phone and laptop and download the small ZIMs. The PWA links to "Open Kiwix." The bigger version is the optional Pi Hub (Prompt 5).

## Licensing: what can be bundled in the app
| Material | Bundle in app? | Why |
| --- | --- | --- |
| ATP 3-50.21 Survival | **Yes** | Approved for public release, distribution unlimited |
| CDC / NWS / FEMA / Ready.gov / FCC text | **Yes**, with source links | US federal government works |
| OpenStreetMap / Protomaps map data | **Yes**, with "© OpenStreetMap contributors" attribution | ODbL ([Protomaps](https://docs.protomaps.com/basemaps/downloads/)) |
| AHA / Red Cross / Stop the Bleed steps | Short factual steps with citation, as in `01` | Facts and procedures, not copied booklets. **Don't embed their PDFs or images**; the ACS Stop the Bleed course PDF says no reproduction without permission |
| Hesperian *Where There Is No Doctor* | **No. Kyle downloads it himself** and adds it in Library | Free for non-commercial copying, but Hesperian asks for permission before **any digital format** use ([Hesperian](https://hesperian.org/wp-content/uploads/pdf/en_wtnd_2025/en_wtnd_2025_fm.pdf)) |
| Kiwix ZIMs | User downloads them; don't bundle | Large files; each has its own license |
