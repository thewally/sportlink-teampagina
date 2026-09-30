/* Teampagina — statische nabootsing van de SportLink team-content.
 *
 * Alle data komt uit de in deze repo gegenereerde JSON-bestanden (data/teams.json
 * en data/team/<teamcode>.json). Er wordt NOOIT rechtstreeks naar SportLink
 * gefetcht, dus het client_id komt nooit in de browser terecht.
 */
'use strict';

var app = document.getElementById('app');

/* ---------- helpers ---------- */

function el(tag, attrs, children) {
  var node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
  }
  (children || []).forEach(function (c) {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function section(title, children) {
  return el('section', { class: 'card' },
    [el('h2', { class: 'bar', text: title })].concat(children || []));
}

/** Simple table; head = array of strings, rows = array of arrays of cell content. */
function table(head, rows, rowClass) {
  var thead = el('thead', null, [el('tr', null, head.map(function (h) {
    return el('th', { text: h });
  }))]);
  var tbody = el('tbody', null, rows.map(function (cells, i) {
    var tr = el('tr', rowClass && rowClass(i) ? { class: rowClass(i) } : null,
      cells.map(function (c) {
        return typeof c === 'object' && c !== null && c.nodeType
          ? el('td', null, [c])
          : el('td', { text: c === null || c === undefined || c === '' ? '-' : String(c) });
      }));
    return tr;
  }));
  return el('div', { class: 'table-wrap' }, [el('table', null, [thead, tbody])]);
}

function empty(msg) {
  return el('p', { class: 'empty', text: msg || 'Geen informatie' });
}

/** Dutch-style average with a comma as decimal separator, e.g. "0,50". */
function gemiddelde(total, count) {
  if (!count) return '-';
  return (total / count).toFixed(2).replace('.', ',');
}

function privacyRegel(n) {
  if (!n) return null;
  return el('p', { class: 'privacy', text:
    'Er ' + (n === 1 ? 'is 1 teamlid' : 'zijn ' + n + ' teamleden') +
    ' van wie de naam vanwege privacyredenen niet getoond wordt.' });
}

function getJSON(url) {
  return fetch(url, { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
    var lm = r.headers.get('Last-Modified');
    if (lm) {
      var span = document.getElementById('generated');
      if (span) span.textContent = new Date(lm).toLocaleString('nl-NL');
    }
    return r.json();
  });
}

/** A team-badge <img>, or an empty placeholder span so table columns stay aligned. */
function logoImg(src, alt) {
  if (!src) return el('span', { class: 'team-logo team-logo-empty' });
  return el('img', {
    class: 'team-logo', src: src, alt: alt || '', loading: 'lazy',
    onerror: "this.replaceWith(Object.assign(document.createElement('span'),{className:'team-logo team-logo-empty'}))"
  });
}

/** "[logo] Thuisteam - Uitteam [logo]" as one inline element for a table cell. */
function matchupCell(thuisteam, thuisLogo, uitteam, uitLogo) {
  return el('span', { class: 'matchup' }, [
    logoImg(thuisLogo, thuisteam),
    el('span', { class: 'matchup-teams', text: (thuisteam || '?') + ' - ' + (uitteam || '?') }),
    logoImg(uitLogo, uitteam)
  ]);
}

function svgIcon(cls, markup) {
  var span = el('span', { class: 'icon ' + cls });
  span.innerHTML = markup;
  return span;
}
function clockIcon() {
  return svgIcon('icon-clock',
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>');
}
function pinIcon() {
  return svgIcon('icon-pin',
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-7.4 7-12.5A7 7 0 0 0 5 8.5C5 13.6 12 21 12 21z"/><circle cx="12" cy="8.5" r="2.5"/></svg>');
}
function plusStatIcon() {
  return svgIcon('stat-icon-svg',
    '<svg viewBox="0 0 40 40" width="22" height="22"><circle cx="12" cy="11" r="4" fill="currentColor"/><circle cx="24" cy="11" r="4" fill="currentColor"/><circle cx="12" cy="23" r="4" fill="currentColor"/><rect x="21" y="20" width="12" height="4.2" rx="2" fill="currentColor"/><rect x="24.9" y="16.1" width="4.2" height="12" rx="2" fill="currentColor"/></svg>');
}
function minusStatIcon() {
  return svgIcon('stat-icon-svg',
    '<svg viewBox="0 0 40 40" width="22" height="22"><circle cx="12" cy="11" r="4" fill="currentColor"/><circle cx="24" cy="11" r="4" fill="currentColor"/><circle cx="12" cy="23" r="4" fill="currentColor"/><rect x="21" y="20" width="12" height="4.2" rx="2" fill="currentColor"/></svg>');
}
function gridStatIcon() {
  return svgIcon('stat-icon-svg',
    '<svg viewBox="0 0 40 40" width="22" height="22"><circle cx="12" cy="11" r="3.6" fill="currentColor"/><circle cx="24" cy="11" r="3.6" fill="currentColor"/><circle cx="12" cy="22" r="3.6" fill="currentColor"/><circle cx="24" cy="22" r="3.6" fill="currentColor"/><circle cx="12" cy="33" r="3.6" fill="currentColor"/><circle cx="24" cy="33" r="3.6" fill="currentColor"/></svg>');
}

/** Generic "no team photo yet" illustration — deliberately not the club crest. */
function silhouetteIcon() {
  return svgIcon('silhouette',
    '<svg viewBox="0 0 220 140" width="220" height="140" aria-hidden="true">' +
    '<g fill="currentColor">' +
    '<ellipse cx="35" cy="45" rx="20" ry="22"/><path d="M0 140 C0 95 15 75 35 75 C55 75 70 95 70 140 Z"/>' +
    '<ellipse cx="185" cy="45" rx="20" ry="22"/><path d="M150 140 C150 95 165 75 185 75 C205 75 220 95 220 140 Z"/>' +
    '<ellipse cx="80" cy="35" rx="22" ry="24"/><path d="M42 140 C42 90 59 68 80 68 C101 68 118 90 118 140 Z"/>' +
    '<ellipse cx="140" cy="35" rx="22" ry="24"/><path d="M102 140 C102 90 119 68 140 68 C161 68 178 90 178 140 Z"/>' +
    '</g></svg>');
}
function ballIcon() {
  return svgIcon('ball',
    '<svg viewBox="0 0 64 64" width="56" height="56"><circle cx="32" cy="32" r="30" fill="#fff" stroke="currentColor" stroke-width="3"/>' +
    '<path d="M32 14 L44 23 L39 38 L25 38 L20 23 Z" fill="currentColor"/>' +
    '<path d="M32 14 V4 M44 23 L53 17 M39 38 L46 53 M25 38 L18 53 M20 23 L11 17" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>');
}

/** Team photo, or the same "no photo yet" empty state SportLink itself shows. */
function fotoBlok(d) {
  var foto = d.details && d.details.foto;
  if (foto) {
    return el('div', { class: 'team-photo' }, [el('img', { src: foto, alt: d.teamnaam })]);
  }
  return el('div', { class: 'team-photo-placeholder' }, [
    el('div', { class: 'placeholder-art' }, [silhouetteIcon(), ballIcon()]),
    el('p', { class: 'placeholder-team', text: d.teamnaam }),
    el('p', { class: 'placeholder-msg', text: 'Er is nog geen teamfoto voor dit team beschikbaar in SportLink.' })
  ]);
}

function teamLink(t) {
  var a = el('a', { href: '?team=' + encodeURIComponent(t.teamcode) },
    [el('strong', { text: t.teamnaam })]);
  var meta = [t.klassepoule, t.competitienaam].filter(Boolean).join(' · ');
  return el('li', null, [a, meta ? el('span', { class: 'meta', text: ' ' + meta }) : null]);
}

function render(nodes) {
  app.innerHTML = '';
  nodes.forEach(function (n) { if (n) app.appendChild(n); });
}

/* ---------- team page (the ten sections) ---------- */

function renderTeam(d) {
  var hoofd = d.hoofdcompetitie || {};

  document.title = d.teamnaam;

  var nodes = [];

  /* 1. Teamtitel */
  nodes.push(el('header', { class: 'team-header' }, [
    el('h1', { class: 'bar', text: d.teamnaam })
  ]));

  /* Teamfoto (of de "nog geen foto" leegstand) */
  nodes.push(fotoBlok(d));

  /* 2. Staf */
  nodes.push(section('Staf', [
    d.staf && d.staf.length
      ? table(['Naam', 'Rol', 'Functie'], d.staf.map(function (m) {
          return [m.naam, m.rol, m.functie];
        }))
      : (d.staf_afgeschermd ? null : empty('Geen stafleden bekend.')),
    privacyRegel(d.staf_afgeschermd)
  ]));

  /* 3. Trainingsschema — geen API-bron, altijd leeg */
  nodes.push(section('Trainingsschema', [
    table(['Dag', 'Tijd', 'Veld', 'Kleedkamer'], []),
    empty('Geen informatie')
  ]));

  /* 4. Programma */
  var programma = d.programma || [];
  nodes.push(section('Programma', [
    programma.length
      ? table(['Datum', 'Wedstrijd', 'Tijd', 'Locatie'], programma.map(function (w) {
          return [
            w.datum,
            matchupCell(w.thuisteam, w.thuisteamLogo, w.uitteam, w.uitteamLogo),
            w.aanvangstijd,
            [w.accommodatie, w.veld, w.plaats].filter(Boolean).join(', ')
          ];
        }))
      : empty('Geen informatie')
  ]));

  /* 5. Uitslagen */
  var uitslagen = d.uitslagen || [];
  nodes.push(section('Uitslagen', [
    uitslagen.length
      ? table(['Datum', 'Wedstrijd', 'Uitslag'], uitslagen.map(function (w) {
          return [
            w.datumopgemaakt,
            matchupCell(w.thuisteam, w.thuisteamLogo, w.uitteam, w.uitteamLogo),
            w.uitslag
          ];
        }))
      : empty('Geen informatie')
  ]));

  /* 6. Poulestanden */
  var stand = d.poulestand || [];
  var pouleTitel = 'Poulestanden ' + d.teamnaam +
    (hoofd.klassepoule ? ' ( ' + hoofd.klassepoule + ' )' : '');
  nodes.push(section(pouleTitel, [
    stand.length
      ? table(
          ['Positie', '', 'Team', 'GS', 'GW', 'GL', 'VL', 'V', 'T', 'Doelsaldo', 'PT'],
          stand.map(function (r) {
            return [r.positie, logoImg(r.logo, r.teamnaam), r.teamnaam,
              r.gespeeldewedstrijden, r.gewonnen, r.gelijk, r.verloren,
              r.doelpuntenvoor, r.doelpuntentegen, r.doelsaldo, r.punten];
          })
        )
      : empty('Geen informatie')
  ]));

  /* 7. Team indeling */
  nodes.push(section('Team indeling', [
    d.spelers && d.spelers.length
      ? table(['Naam', 'Rol', 'Functie'], d.spelers.map(function (m) {
          return [m.naam, m.rol, m.functie];
        }))
      : (d.spelers_afgeschermd ? null : empty('Geen spelers bekend.')),
    privacyRegel(d.spelers_afgeschermd)
  ]));

  /* 8. Wedstrijdverslagen — geen databron */
  nodes.push(section('Wedstrijdverslagen', [
    empty('Er zijn nog geen wedstrijdverslagen beschikbaar voor dit team.')
  ]));

  /* 9 + 10. Countdown en Stats — naast elkaar, zoals op de referentiepagina */
  nodes.push(el('div', { class: 'countdown-stats' }, [
    el('div', { class: 'cs-col' }, [
      el('h2', { class: 'bar', text: 'Countdown' }),
      countdownBox(d, programma[0])
    ]),
    el('div', { class: 'cs-col' }, [
      el('h2', { class: 'bar', text: 'Stats' }),
      statsBox(d, stand, uitslagen)
    ])
  ]));

  render(nodes);
}

var COMPETITIESOORT_LABEL = {
  regulier: 'Competitie', beker: 'Beker', oefenwedstrijd: 'Oefenwedstrijd'
};

/** Countdown-kaart: volgende wedstrijd, logo's, en een live aftellende timer. */
function countdownBox(d, next) {
  if (!next) {
    return el('div', { class: 'box' }, [
      empty('Voor dit team zijn er geen wedstrijden ingepland.')
    ]);
  }
  var soort = COMPETITIESOORT_LABEL[next.competitiesoort] || next.competitiesoort || '';
  var box = el('div', { class: 'box cd-box' }, [
    el('p', { class: 'cd-heading', text: 'Volgende wedstrijd' }),
    soort ? el('p', { class: 'cd-soort', text: soort }) : null,
    el('div', { class: 'cd-teams' }, [
      el('span', { class: 'cd-team', text: next.thuisteam || '?' }),
      el('span', { class: 'cd-vs', text: 'VS' }),
      el('span', { class: 'cd-team', text: next.uitteam || '?' })
    ]),
    el('div', { class: 'cd-logos' }, [
      logoImg(next.thuisteamLogo, next.thuisteam),
      logoImg(next.uitteamLogo, next.uitteam)
    ]),
    el('div', { class: 'cd-meta' }, [
      el('span', { class: 'cd-meta-item' }, [clockIcon(),
        el('span', { text: [next.datum, next.aanvangstijd ? next.aanvangstijd + ' uur' : null].filter(Boolean).join(' ') })]),
      el('span', { class: 'cd-meta-item' }, [pinIcon(),
        el('span', { text: [next.accommodatie, next.veld].filter(Boolean).join(', ') || '-' })])
    ]),
    el('div', { class: 'cd-timer' }, ['Dag', 'Uur', 'Min', 'Sec'].map(function (label) {
      return el('div', { class: 'cd-timer-cell' }, [
        el('div', { class: 'cd-timer-num', 'data-unit': label, text: '00' }),
        el('div', { class: 'cd-timer-label', text: label })
      ]);
    }))
  ]);
  if (next.wedstrijddatum) startCountdownTimer(box, next.wedstrijddatum);
  return box;
}

function startCountdownTimer(box, isoDate) {
  var target = new Date(isoDate).getTime();
  if (isNaN(target)) return;
  var cells = {
    Dag: box.querySelector('[data-unit="Dag"]'),
    Uur: box.querySelector('[data-unit="Uur"]'),
    Min: box.querySelector('[data-unit="Min"]'),
    Sec: box.querySelector('[data-unit="Sec"]')
  };
  function pad(n) { return String(Math.max(0, n)).padStart(2, '0'); }
  function tick() {
    var diff = Math.max(0, target - Date.now());
    var s = Math.floor(diff / 1000);
    cells.Dag.textContent = pad(Math.floor(s / 86400));
    cells.Uur.textContent = pad(Math.floor((s % 86400) / 3600));
    cells.Min.textContent = pad(Math.floor((s % 3600) / 60));
    cells.Sec.textContent = pad(s % 60);
  }
  tick();
  setInterval(tick, 1000);
}

/** Stats-kaart: teamnaam/competitiecode + drie gemiddeldes met icoon. */
function statsBox(d, stand, uitslagen) {
  var kids = [el('p', { class: 'stats-team', text: d.teamnaam })];
  var hoofd = d.hoofdcompetitie || {};
  if (hoofd.competitienaam) {
    kids.push(el('p', { class: 'stats-sub', text: hoofd.competitienaam.toLowerCase() }));
  }

  var c = berekenGemiddeldes(d, stand, uitslagen);
  if (!c) {
    kids.push(empty('Nog geen gespeelde wedstrijden bekend.'));
    return el('div', { class: 'box' }, kids);
  }

  kids.push(statRow('green', plusStatIcon(), gemiddelde(c.voor, c.gespeeld), 'doelpunten voor'));
  kids.push(statRow('red', minusStatIcon(), gemiddelde(c.tegen, c.gespeeld), 'doelpunten tegen'));
  kids.push(statRow('dark', gridStatIcon(), gemiddelde(c.punten, c.gespeeld), 'punten'));
  kids.push(el('p', { class: 'note', text: c.bron }));
  return el('div', { class: 'box' }, kids);
}

function statRow(tone, icon, value, label) {
  return el('div', { class: 'stat-row' }, [
    el('span', { class: 'stat-icon stat-icon-' + tone }, [icon]),
    el('span', { class: 'stat-text' }, [
      el('span', { class: 'stat-value', text: value }),
      el('span', { class: 'stat-label' }, [
        document.createTextNode('gemiddeld aantal '),
        el('strong', { text: label }),
        document.createTextNode(' per wedstrijd')
      ])
    ])
  ]);
}

/** Gemiddeldes uit de eigen poulestand-rij, anders uit de bekende uitslagen. */
function berekenGemiddeldes(d, stand, uitslagen) {
  var eigen = stand.filter(function (r) { return String(r.eigenteam) === 'true'; })[0];
  var gespeeld, voor, tegen, punten, bron;

  if (eigen && eigen.gespeeldewedstrijden) {
    gespeeld = eigen.gespeeldewedstrijden;
    voor = eigen.doelpuntenvoor;
    tegen = eigen.doelpuntentegen;
    punten = eigen.punten;
    bron = 'Berekend uit de poulestand (' + gespeeld + ' gespeelde wedstrijden).';
  } else {
    gespeeld = 0; voor = 0; tegen = 0; punten = 0;
    uitslagen.forEach(function (w) {
      var m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(w.uitslag || '');
      if (!m) return;
      var home = w.thuisteam === d.teamnaam;
      var mine = parseInt(home ? m[1] : m[2], 10);
      var theirs = parseInt(home ? m[2] : m[1], 10);
      gespeeld += 1; voor += mine; tegen += theirs;
      punten += mine > theirs ? 3 : (mine === theirs ? 1 : 0);
    });
    bron = gespeeld
      ? 'Geen poulestand beschikbaar; berekend uit ' + gespeeld + ' bekende uitslag(en).'
      : '';
  }

  if (!gespeeld) return null;
  return { gespeeld: gespeeld, voor: voor, tegen: tegen, punten: punten, bron: bron };
}

/* ---------- overview / search / disambiguation ---------- */

function renderOverzicht(index) {
  document.title = 'Teams';
  var teams = index.teams || [];

  render([
    el('header', { class: 'team-header' }, [
      el('h1', { class: 'bar', text: 'Teams' }),
      el('p', { class: 'subtitle', text:
        'Kies een team, of open een pagina direct via ?team=<teamcode> of ?team=<tekst>.' })
    ]),
    el('section', { class: 'card' }, [
      teams.length
        ? el('ul', { class: 'teamlist' }, teams.map(teamLink))
        : empty('Geen teams beschikbaar. Draai scripts/sync.py om de data te vullen.')
    ])
  ]);
}

function renderDisambiguatie(query, hits) {
  document.title = 'Meerdere teams gevonden';
  render([
    el('header', { class: 'team-header' }, [
      el('h1', { class: 'bar', text: 'Meerdere teams gevonden' }),
      el('p', { class: 'subtitle', text:
        hits.length + ' teams passen bij “' + query + '”. Kies het juiste team:' })
    ]),
    el('section', { class: 'card' }, [
      el('ul', { class: 'teamlist' }, hits.map(teamLink)),
      el('p', { class: 'backlink' }, [el('a', { href: '.', text: '← Alle teams' })])
    ])
  ]);
}

function renderFout(msg) {
  document.title = 'Niet gevonden';
  render([
    el('header', { class: 'team-header' }, [el('h1', { class: 'bar', text: 'Niet gevonden' })]),
    el('section', { class: 'card' }, [
      el('p', { class: 'error', text: msg }),
      el('p', { class: 'backlink' }, [el('a', { href: '.', text: '← Alle teams' })])
    ])
  ]);
}

/* ---------- entry point ---------- */

function start() {
  var param = (new URLSearchParams(location.search).get('team') || '').trim();

  getJSON('data/teams.json').then(function (index) {
    var teams = index.teams || [];

    if (!param) return renderOverzicht(index);

    // 1. Exacte match op teamcode.
    var exact = teams.filter(function (t) { return String(t.teamcode) === param; });
    if (exact.length === 1) return loadTeam(exact[0].teamcode);

    // 2. Case-insensitieve substring-match op teamnaam.
    var needle = param.toLowerCase();
    var hits = teams.filter(function (t) {
      return t.teamnaam.toLowerCase().indexOf(needle) !== -1;
    });
    // Een exacte naam-match wint van bredere substring-treffers.
    var exactName = hits.filter(function (t) {
      return t.teamnaam.toLowerCase() === needle;
    });
    if (exactName.length === 1) return loadTeam(exactName[0].teamcode);

    if (hits.length === 1) return loadTeam(hits[0].teamcode);
    if (hits.length > 1) return renderDisambiguatie(param, hits);
    return renderFout('Geen team gevonden voor “' + param +
      '”. Probeer een teamcode of een deel van de teamnaam.');
  }).catch(function (err) {
    renderFout('Kon de teamlijst niet laden: ' + err.message);
  });
}

function loadTeam(teamcode) {
  return getJSON('data/team/' + encodeURIComponent(teamcode) + '.json')
    .then(renderTeam)
    .catch(function (err) {
      renderFout('Kon de teamgegevens niet laden: ' + err.message);
    });
}

start();
