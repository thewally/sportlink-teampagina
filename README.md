# SportLink teampagina (statisch)

Een losstaande, volledig statische website (HTML/CSS/vanilla JS, geen build-stap) die
de **team-specifieke content** van een SportLink-teampagina nabootst — zoals
`https://www.vvz49.nl/vvz-49-o16-1-zaterdag-speeldag-man`, maar **alleen het teamdeel**:
geen clubmenu, contactgegevens, sponsors, verjaardagen of verenigingsactiviteiten.

## Scope: drie teams

De site toont bewust maar **drie** teams — de ST-combiteams van SO Soest en VVZ'49:

| Team | Teamcode (seizoen 2026/27) |
| --- | --- |
| `ST SO Soest/VVZ'49 O14-1` | 289917 |
| `ST SO Soest/VVZ'49 O14-2` | 304979 |
| `ST SO Soest/VVZ'49 O14-6` | 304987 |

De administratie bevat ~157 team-rijen (83 unieke teams), maar `scripts/sync.py` filtert
daar op teamnaam de drie bovenstaande uit. Wil je teams toevoegen of wijzigen: pas de
`TEAMS`-set bovenin `scripts/sync.py` aan en draai het script opnieuw. Er wordt op
**teamnaam** gefilterd en niet op teamcode, omdat teamcodes per seizoen wisselen.

## Hoe het werkt

De browser praat **nooit** met SportLink. Een Python-script haalt alle data server-side op
en schrijft platte JSON-bestanden in de repo; de frontend fetcht alleen die bestanden.

```
scripts/sync.py   ──(SPORTLINK_CLIENT_ID uit env)──►  data.sportlink.com
        │
        ├─► data/teams.json              index van de drie teams (naam/tekst → teamcode)
        ├─► data/team/<teamcode>.json    alle content van één team
        └─► data/state/uitslagen/<teamcode>.json   groeiend uitslagen-archief (zie hieronder)

index.html + app.js + style.css  ──fetch──►  data/*.json   (statisch, geen secrets)
```

Daardoor staat het `client_id` **nergens** in gecommitte HTML/JS/CSS en is het voor de
eindgebruiker nooit zichtbaar.

## Gebruik: de `?team=` parameter

| URL | Gedrag |
| --- | --- |
| `index.html` | Lijst met de drie teams |
| `index.html?team=289917` | Exacte match op `teamcode` → direct de teampagina |
| `index.html?team=ST SO Soest/VVZ'49 O14-1` | Exacte match op teamnaam (case-insensitief) |
| `index.html?team=O14-2` | Substring-match; 1 treffer → direct die teampagina |
| `index.html?team=O14` | Meerdere treffers → disambiguatie-lijst met klikbare links |
| `index.html?team=bestaatniet` | Nette foutmelding + link terug naar het overzicht |

## Content per teampagina

Precies tien secties, in deze volgorde: **Teamtitel**, **Staf**, **Trainingsschema**,
**Programma**, **Uitslagen**, **Poulestanden**, **Team indeling**, **Wedstrijdverslagen**,
**Countdown**, **Stats**.

De Stats-sectie rekent gemiddeld doelpunten voor, doelpunten tegen en punten per wedstrijd
uit de eigen-team-rij van de poulestand (en valt terug op de bekende uitslagen als er geen
poulestand is), met een komma als decimaalteken.

## Het `client_id` hoort bij "So Soest", niet bij VVZ'49

Het gebruikte `client_id` is de widget-sleutel van **So Soest**, niet van VVZ'49. De
teamnamen in deze administratie beginnen daarom met `Soest SO ...`. Dat is **geen bug**:
het is bewust dit `client_id`. De drie teams die deze site toont zijn juist de gedeelde
ST-combiteams (`ST SO Soest/VVZ'49 O14-x`), die in deze administratie staan. Wil je de
VVZ'49-administratie zelf, dan moet het `client_id` van VVZ'49 in het secret staan; de
rest van de code verandert niet (wel mogelijk de teamnamen in `TEAMS`).

## Bekende beperkingen (API, niet deze code)

* **`/uitslagen` geeft altijd alleen de meest recente speeldag terug**, nooit de volledige
  seizoenshistorie. Dat is een limitatie van de publieke SportLink widget-API zelf.
  Daarom houdt `sync.py` een **accumulerend archief** bij in
  `data/state/uitslagen/<teamcode>.json`: elke sync-run merget nieuwe wedstrijden erbij op
  `wedstrijdcode`. De uitslagenlijst groeit dus mee zolang de cron-job blijft lopen — maar
  wedstrijden van vóór de eerste sync-run komen er nooit meer bij.
* **Trainingsschema heeft geen databron.** Er is geen SportLink-endpoint voor
  trainingstijden/velden/kleedkamers gevonden. De tabel is daarom altijd leeg met
  "Geen informatie" — net als op de echte pagina. Er wordt niets verzonnen.
* **Wedstrijdverslagen heeft geen databron.** Altijd de statische tekst
  "Er zijn nog geen wedstrijdverslagen beschikbaar voor dit team."
* **Namen kunnen "Afgeschermd" zijn.** Dat is een privacy-instelling per lid in de
  administratie. Afgeschermde leden worden niet als rij gerenderd, maar samengevat in
  één regel ("Er zijn N teamleden van wie de naam vanwege privacyredenen niet getoond
  wordt."), apart geteld voor Staf en voor Team indeling. Zichtbare namen staan gewoon
  in de tabel.
* **Ongebruikte velden worden bewust weggegooid** door `sync.py`: cluborlogo-URL's bevatten
  een `expires`/`sig` die elke run verandert (zou elke sync een diff geven) en
  e-mail/telefoon van leden worden niet opgeslagen.

## Lokaal draaien

```bash
# Data verversen (client_id NIET in een bestand zetten):
SPORTLINK_CLIENT_ID=<jouw-client-id> python3 scripts/sync.py

# Site serveren:
python3 -m http.server 8000
# → http://localhost:8000/?team=289917
```

`sync.py` gebruikt alleen de Python-standaardbibliotheek (`urllib`), dus geen
`pip install` nodig. Eén team komt meerdere keren voor in `/teams` (één rij per
competitie, bv. `regulier` naast `beker`); de rij met `competitiesoort == "regulier"`
bepaalt de teamnaam en de `poulecode` voor de poulestand, met de eerste rij als fallback.
Teams met `teamcode -1` (lokale, niet-bondse teams) worden overgeslagen: bij `/programma`
en `/uitslagen` werkt `teamcode=-1` als wildcard en levert dan clubbrede data op.

## Nog te doen na het aanmaken van de GitHub-repo

Dit is **nog niet gebeurd** en moet handmatig, eenmalig:

1. GitHub-repo aanmaken en deze `main` branch pushen.
2. Secret zetten: `gh secret set SPORTLINK_CLIENT_ID` (waarde = het So Soest `client_id`).
   Zonder dit secret faalt de sync-workflow direct met een duidelijke foutmelding.
3. GitHub Pages inschakelen: **classic branch-based**, source `main` / `/ (root)`.
   Er is geen aparte deploy-workflow; Pages serveert de repo-root rechtstreeks.
4. Controleren dat `.nojekyll` in de repo-root staat (die is er al) — zonder dat bestand
   haalt Pages de site door Jekyll, wat in deze repo-familie eerder problemen gaf.
5. Eventueel `.github/workflows/sync-sportlink.yml` één keer met `workflow_dispatch`
   starten om te verifiëren dat het secret werkt.
