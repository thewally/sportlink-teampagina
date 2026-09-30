#!/usr/bin/env python3
"""Sync SportLink team data into static JSON files under data/.

Runs server-side only (locally or in GitHub Actions). The SportLink client_id is
read from the SPORTLINK_CLIENT_ID environment variable and is NEVER written into
any generated file, so it never reaches the browser.

Usage:
    SPORTLINK_CLIENT_ID=xxxxxxxx python3 scripts/sync.py
"""

import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://data.sportlink.com"
BINARIES = "https://binaries.sportlink.com"

# Deze site toont bewust maar drie teams: de ST-combiteams van SO Soest en
# VVZ'49. Ze worden op teamnaam geselecteerd uit /teams (teamcodes wisselen per
# seizoen, namen niet). De teamcodes in het huidige seizoen staan erbij ter
# referentie.
TEAMS = {
    "ST SO Soest/VVZ'49 O14-1",  # teamcode 289917
    "ST SO Soest/VVZ'49 O14-2",  # teamcode 304979
    "ST SO Soest/VVZ'49 O14-6",  # teamcode 304987
}
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TEAM_DIR = DATA / "team"
STATE_DIR = DATA / "state" / "uitslagen"
LOGO_DIR = DATA / "logos"
PHOTO_DIR = DATA / "photos"

RETRIES = 3
SLEEP = 0.15

# Fields copied verbatim; "more"/"meer" links (query strings) and personal
# contact details are dropped on purpose (privacy / never useful to us).
# Logo fields are handled separately by resolve_logo(): the SportLink CDN
# URLs carry an expiring signature that would churn on every sync even
# though the image itself doesn't change, so we cache the image bytes
# locally under data/logos/<document-id>.<ext> (the document id in the URL
# path is stable across signatures) and store that local path instead.
PROGRAMMA_FIELDS = (
    "wedstrijdcode", "wedstrijddatum", "datum", "aanvangstijd", "wedstrijd",
    "thuisteam", "uitteam", "accommodatie", "veld", "plaats", "status",
    "competitiesoort", "klassepoule",
)
UITSLAGEN_FIELDS = (
    "wedstrijdcode", "wedstrijddatum", "datumopgemaakt", "wedstrijd", "uitslag",
    "thuisteam", "uitteam", "accommodatie", "status", "competitiesoort",
)
POULESTAND_FIELDS = (
    "positie", "teamnaam", "gespeeldewedstrijden", "gewonnen", "gelijk",
    "verloren", "doelpuntenvoor", "doelpuntentegen", "doelsaldo",
    "verliespunten", "punten", "eigenteam",
)
TEAM_FIELDS = (
    "teamcode", "teamnaam", "poulecode", "competitienaam", "klasse", "poule",
    "klassepoule", "spelsoort", "competitiesoort", "geslacht", "teamsoort",
    "leeftijdscategorie", "speeldag", "speeldagteam",
)
DETAIL_FIELDS = (
    "teamnaam", "begindatum", "einddatum", "competitie", "geslacht",
    "categorie", "shirtkleur", "broekkleur", "kousen", "omschrijving",
)


def client_id() -> str:
    cid = os.environ.get("SPORTLINK_CLIENT_ID", "").strip()
    if not cid:
        sys.exit(
            "ERROR: SPORTLINK_CLIENT_ID is not set.\n"
            "Run as: SPORTLINK_CLIENT_ID=<id> python3 scripts/sync.py"
        )
    return cid


def get(path: str, cid: str, **params):
    """GET an endpoint and return the parsed JSON, or None on failure."""
    params["client_id"] = cid
    url = f"{BASE}/{path}?" + urllib.parse.urlencode(params)
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "sportlink-teampagina/1.0"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            if attempt == RETRIES:
                # Never leak the client_id into logs.
                print(f"  ! {path} failed after {RETRIES} tries: {exc}", file=sys.stderr)
                return None
            time.sleep(attempt * 1.0)
    return None


def pick(item: dict, fields) -> dict:
    out = {}
    for f in fields:
        v = item.get(f)
        if isinstance(v, str):
            v = v.strip()
        out[f] = v
    return out


def is_shielded(value) -> bool:
    return isinstance(value, str) and value.strip().lower() == "afgeschermd"


def split_indeling(members):
    """Split team members into staff and players, counting shielded names."""
    staf, spelers = [], []
    staf_afgeschermd = spelers_afgeschermd = 0
    for m in members or []:
        rol = (m.get("rol") or "").strip()
        row = {
            "naam": (m.get("naam") or "").strip(),
            "rol": rol,
            "functie": (m.get("functie") or "").strip(),
        }
        player = rol == "Teamspeler"
        if is_shielded(row["naam"]):
            if player:
                spelers_afgeschermd += 1
            else:
                staf_afgeschermd += 1
            continue
        (spelers if player else staf).append(row)
    staf.sort(key=lambda r: (r["rol"], r["functie"], r["naam"]))
    spelers.sort(key=lambda r: r["naam"])
    return staf, spelers, staf_afgeschermd, spelers_afgeschermd


def primary_entry(entries):
    """The 'regulier' competition entry decides name/poule; else the first one."""
    for e in entries:
        if (e.get("competitiesoort") or "").strip() == "regulier":
            return e
    return entries[0]


def merge_uitslagen(teamcode: int, fresh: list) -> list:
    """Accumulate results over time.

    /uitslagen only ever returns the most recent match day, so keep a growing
    archive per team keyed on wedstrijdcode and merge each run into it.
    """
    state_file = STATE_DIR / f"{teamcode}.json"
    archive = {}
    if state_file.exists():
        try:
            for row in json.loads(state_file.read_text(encoding="utf-8")):
                code = row.get("wedstrijdcode")
                if code is not None:
                    archive[str(code)] = row
        except (json.JSONDecodeError, OSError):
            archive = {}
    for row in fresh:
        code = row.get("wedstrijdcode")
        archive[str(code) if code is not None else row.get("wedstrijd", "")] = row

    merged = sorted(
        archive.values(),
        key=lambda r: (r.get("wedstrijddatum") or ""),
        reverse=True,
    )
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(merged, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    return merged


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )


DOC_ID_RE = re.compile(r"/([A-F0-9]{16,})(?:[/?]|$)", re.IGNORECASE)
CONTENT_TYPE_EXT = {
    "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/svg+xml": "svg", "image/webp": "webp", "image/gif": "gif",
}
_logo_cache: dict[str, str | None] = {}


def resolve_logo(url) -> str | None:
    """Download a club-logo URL once and cache it locally by its stable
    document id, returning a site-relative path ("data/logos/<id>.<ext>")
    or None. The URL's own query string (expiry/signature) is ignored for
    caching purposes since only the path's document id is stable."""
    if not isinstance(url, str) or not url.startswith(BINARIES):
        return None
    m = DOC_ID_RE.search(url)
    if not m:
        return None
    doc_id = m.group(1).upper()
    if doc_id in _logo_cache:
        return _logo_cache[doc_id]

    existing = list(LOGO_DIR.glob(f"{doc_id}.*")) if LOGO_DIR.exists() else []
    if existing:
        rel = f"data/logos/{existing[0].name}"
        _logo_cache[doc_id] = rel
        return rel

    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "sportlink-teampagina/1.0"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
                ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip()
            ext = CONTENT_TYPE_EXT.get(ctype, "png")
            LOGO_DIR.mkdir(parents=True, exist_ok=True)
            (LOGO_DIR / f"{doc_id}.{ext}").write_bytes(body)
            rel = f"data/logos/{doc_id}.{ext}"
            _logo_cache[doc_id] = rel
            return rel
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == RETRIES:
                print(f"  ! logo download failed ({doc_id}): {exc}", file=sys.stderr)
                _logo_cache[doc_id] = None
                return None
            time.sleep(attempt * 0.5)
    return None


def save_teamfoto(teamcode, b64_data) -> str | None:
    """Decode a base64 team photo from team-gegevens and save it once per
    sync run (the API re-sends it unchanged every time there is one, so we
    just overwrite — no need to diff-check base64 text)."""
    if not b64_data:
        return None
    try:
        raw = base64.b64decode(b64_data, validate=False)
    except (ValueError, base64.binascii.Error) as exc:
        print(f"  ! kon teamfoto van {teamcode} niet decoderen: {exc}", file=sys.stderr)
        return None
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    path = PHOTO_DIR / f"{teamcode}.jpg"
    path.write_bytes(raw)
    return f"data/photos/{teamcode}.jpg"


def main() -> int:
    cid = client_id()

    raw_teams = get("teams", cid, gebruiklokaleteamgegevens="NEE")
    if not isinstance(raw_teams, list) or not raw_teams:
        sys.exit("ERROR: /teams returned no usable data; aborting without touching data/.")
    print(f"/teams: {len(raw_teams)} entries")

    # Group the team rows by teamcode (one team can appear once per competition).
    by_code: dict[int, list] = {}
    for t in raw_teams:
        code = t.get("teamcode")
        naam = (t.get("teamnaam") or "").strip()
        if code is None or naam not in TEAMS:
            continue
        if code <= 0:
            # Lokale (niet-bondse) teams hebben teamcode -1 en worden door
            # SportLink op lokaleteamcode geidentificeerd. teamcode=-1 werkt bij
            # /programma en /uitslagen als wildcard en levert dan clubbrede data
            # op, dus die zijn hier onbruikbaar.
            print(f"  ! '{naam}' is een lokaal team (teamcode -1); overgeslagen.")
            continue
        by_code.setdefault(code, []).append(pick(t, TEAM_FIELDS))

    gevonden = {e[0].get("teamnaam") for e in by_code.values()}
    for ontbreekt in sorted(TEAMS - gevonden):
        print(f"  ! LET OP: '{ontbreekt}' komt niet voor in /teams.", file=sys.stderr)
    if not by_code:
        sys.exit(
            "ERROR: geen van de geconfigureerde teams gevonden in /teams.\n"
            "Controleer de TEAMS-set in scripts/sync.py tegen de actuele teamnamen."
        )
    print(f"geselecteerd: {len(by_code)} van {len(TEAMS)} geconfigureerde teams")

    poule_cache: dict[int, list] = {}
    index = []
    ok = failed = 0

    for n, (teamcode, entries) in enumerate(sorted(by_code.items()), start=1):
        main_entry = primary_entry(entries)
        naam = main_entry.get("teamnaam") or f"Team {teamcode}"
        print(f"[{n}/{len(by_code)}] {teamcode} {naam}")

        members = get(
            "team-indeling", cid, teamcode=teamcode, lokaleteamcode=-1,
            gebruiklokaleteamgegevens="NEE",
        )
        staf, spelers, staf_shield, spelers_shield = split_indeling(members)

        details_raw = get("team-gegevens", cid, teamcode=teamcode, lokaleteamcode=-1)
        details = {}
        foto = None
        if isinstance(details_raw, dict) and isinstance(details_raw.get("team"), dict):
            team_raw = details_raw["team"]
            details = pick(team_raw, DETAIL_FIELDS)
            foto = save_teamfoto(teamcode, team_raw.get("teamfoto"))
        details["foto"] = foto

        programma_raw = get(
            "programma", cid, teamcode=teamcode, eigenwedstrijden="JA", thuis="JA",
            uit="JA", gebruiklokaleteamgegevens="NEE", aantaldagen=365,
        )
        programma = []
        for w in (programma_raw or []):
            row = pick(w, PROGRAMMA_FIELDS)
            row["thuisteamLogo"] = resolve_logo(w.get("thuisteamlogo"))
            row["uitteamLogo"] = resolve_logo(w.get("uitteamlogo"))
            programma.append(row)
        programma.sort(key=lambda r: (r.get("wedstrijddatum") or ""))

        uitslagen_raw = get(
            "uitslagen", cid, teamcode=teamcode, eigenwedstrijden="JA", thuis="JA",
            uit="JA", gebruiklokaleteamgegevens="NEE",
        )
        fresh_uitslagen = []
        for w in (uitslagen_raw or []):
            row = pick(w, UITSLAGEN_FIELDS)
            row["thuisteamLogo"] = resolve_logo(w.get("thuisteamlogo"))
            row["uitteamLogo"] = resolve_logo(w.get("uitteamlogo"))
            fresh_uitslagen.append(row)
        uitslagen = merge_uitslagen(teamcode, fresh_uitslagen)

        poulecode = main_entry.get("poulecode")
        poulestand = []
        if poulecode and poulecode != -1:
            if poulecode not in poule_cache:
                rows = get("poulestand", cid, poulecode=poulecode)
                cached = []
                for r in (rows or []):
                    row = pick(r, POULESTAND_FIELDS)
                    row["logo"] = resolve_logo(r.get("clublogo"))
                    cached.append(row)
                poule_cache[poulecode] = cached
                time.sleep(SLEEP)
            poulestand = poule_cache[poulecode]

        own_logo = next(
            (r["logo"] for r in poulestand if str(r.get("eigenteam")) == "true" and r.get("logo")),
            None,
        )

        if members is None and programma_raw is None and uitslagen_raw is None:
            failed += 1
        else:
            ok += 1

        write_json(TEAM_DIR / f"{teamcode}.json", {
            "teamcode": teamcode,
            "teamnaam": naam,
            "competities": entries,
            "hoofdcompetitie": main_entry,
            "details": details,
            "ownLogo": own_logo,
            "staf": staf,
            "spelers": spelers,
            "staf_afgeschermd": staf_shield,
            "spelers_afgeschermd": spelers_shield,
            "programma": programma,
            "uitslagen": uitslagen,
            "poulestand": poulestand,
        })

        index.append({
            "teamcode": teamcode,
            "teamnaam": naam,
            "competitienaam": main_entry.get("competitienaam") or "",
            "klasse": main_entry.get("klasse") or "",
            "klassepoule": main_entry.get("klassepoule") or "",
            "leeftijdscategorie": main_entry.get("leeftijdscategorie") or "",
            "geslacht": main_entry.get("geslacht") or "",
            "speeldag": main_entry.get("speeldag") or "",
        })
        time.sleep(SLEEP)

    index.sort(key=lambda t: (t["leeftijdscategorie"], t["teamnaam"]))
    write_json(DATA / "teams.json", {"aantal": len(index), "teams": index})

    print(f"\nDone: {ok} teams with data, {failed} teams without any match/member data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
