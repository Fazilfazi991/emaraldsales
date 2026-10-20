"""Read-only inspection of fresh synthetic runtime downloads; no PDF authoring."""
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

root = Path("evidence/phase4/runtime")
runtime = json.loads((root / "result.json").read_text(encoding="utf-8"))
files = []
for download in runtime["downloads"]:
    path = Path(download["path"])
    item = {"file": path.name, "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    if path.suffix == ".pdf":
        reader = PdfReader(path)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        item.update(pages=len(reader.pages), arabicCharacters=len(re.findall(r"[\u0600-\u06ff]", text)),
                    malayalamCharacters=len(re.findall(r"[\u0d00-\u0d7f]", text)))
        assert item["arabicCharacters"] > 0
        if path.name.startswith("all-staff"):
            assert item["malayalamCharacters"] > 0
            assert "D’Souza" in text
        assert "Asia/Dubai" in text and "Generated" in text
        font_names = set()
        embedded = 0
        for page in reader.pages:
            for ref in page["/Resources"]["/Font"].values():
                font = ref.get_object()
                font_names.add(str(font.get("/BaseFont", "")))
                descendants = font.get("/DescendantFonts", [font])
                for descendant in descendants:
                    descriptor = descendant.get_object().get("/FontDescriptor")
                    if descriptor:
                        descriptor = descriptor.get_object()
                        if any(key in descriptor for key in ["/FontFile", "/FontFile2", "/FontFile3"]):
                            embedded += 1
        assert embedded > 0
        item.update(fonts=sorted(font_names), embeddedFontReferences=embedded)
    files.append(item)
result = {
    "status": "passed", "sourceCommit": runtime["sourceCommit"],
    "scope": "Fresh native downloads from prepared synthetic local database",
    "checks": ["Eight download bytes/hashes recorded", "All four PDFs have Arabic text, UAE date context and embedded fonts",
               "All-staff PDF also has Malayalam and accented Latin; all-staff XLSX exact-name checks passed in runtime harness"],
    "files": files,
    "visualInspection": {"by": "Coordinator", "renderedPages": ["all-staff-activity.png", "selected-staff-duty.png"],
                         "observed": "Arabic and Malayalam glyphs visible/shaped, wrapped cells readable, no observed missing-glyph boxes or overlaps",
                         "nativeLanguageClientApproval": "pending", "physicalDevice": False},
    "displayObservation": "Duty/rest/active minutes are independently rounded; short synthetic intervals can show a small arithmetic residual. See Phase 4 acceptance report."
}
(root / "report-review.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print("Eight runtime files inspected; four PDFs retain embedded fonts/context; all-staff Arabic/Malayalam/Latin checks passed.")
