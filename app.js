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
  var subtitle = [hoofd.competitienaam, hoofd.klassepoule || hoofd.klasse]
    .filter(Boolean).join(' — ');

  document.title = d.teamnaam;

  var nodes = [];

  /* 1. Teamtitel */
  nodes.push(el('header', { class: 'team-header' }, [
    el('h1', { class: 'bar', text: d.teamnaam }),
    subtitle ? el('p', { class: 'subtitle', text: subtitle }) : null,
    el('p', { class: 'backlink' }, [el('a', { href: '.', text: '← Alle teams' })])
  ]));

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
            w.wedstrijd,
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
          return [w.datumopgemaakt, w.wedstrijd, w.uitslag];
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
          ['Positie', 'Team', 'GS', 'GW', 'GL', 'VL', 'V', 'T', 'Doelsaldo', 'PT'],
          stand.map(function (r) {
            return [r.positie, r.teamnaam, r.gespeeldewedstrijden, r.gewonnen,
              r.gelijk, r.verloren, r.doelpuntenvoor, r.doelpuntentegen,
              r.doelsaldo, r.punten];
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

  /* 9. Countdown — eerstvolgende nog te spelen wedstrijd */
  var next = programma[0];
  nodes.push(section('Countdown', [
    next
      ? el('div', { class: 'countdown' }, [
          el('p', { class: 'cd-match', text: next.wedstrijd }),
          el('p', { class: 'cd-when', text:
            [next.datum, next.aanvangstijd].filter(Boolean).join(' — ') }),
          next.accommodatie
            ? el('p', { class: 'cd-where', text:
                [next.accommodatie, next.plaats].filter(Boolean).join(', ') })
            : null
        ])
      : empty('Voor dit team zijn er geen wedstrijden ingepland.')
  ]));

  /* 10. Stats — gemiddeldes uit de eigen poulestand-rij, anders uit de uitslagen */
  nodes.push(section('Stats', [
    el('p', { class: 'stats-team', text: d.teamnaam }),
    hoofd.competitienaam
      ? el('p', { class: 'subtitle', text: hoofd.competitienaam })
      : null
  ].concat(statsBlok(d, stand, uitslagen))));

  render(nodes);
}

function statsBlok(d, stand, uitslagen) {
  var eigen = stand.filter(function (r) { return String(r.eigenteam) === 'true'; })[0];
  var gespeeld, voor, tegen, punten, bron;

  if (eigen && eigen.gespeeldewedstrijden) {
    gespeeld = eigen.gespeeldewedstrijden;
    voor = eigen.doelpuntenvoor;
    tegen = eigen.doelpuntentegen;
    punten = eigen.punten;
    bron = 'Berekend uit de poulestand (' + gespeeld + ' gespeelde wedstrijden).';
  } else {
    // Fallback: bereken zelf uit de uitslagen die we hebben.
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
      : 'Nog geen gespeelde wedstrijden bekend.';
  }

  if (!gespeeld) return [empty('Nog geen gespeelde wedstrijden bekend.')];

  return [
    el('dl', { class: 'stats' }, [
      el('dt', { text: 'Gemiddeld doelpunten voor' }),
      el('dd', { text: gemiddelde(voor, gespeeld) }),
      el('dt', { text: 'Gemiddeld doelpunten tegen' }),
      el('dd', { text: gemiddelde(tegen, gespeeld) }),
      el('dt', { text: 'Gemiddeld punten per wedstrijd' }),
      el('dd', { text: gemiddelde(punten, gespeeld) })
    ]),
    el('p', { class: 'note', text: bron })
  ];
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
