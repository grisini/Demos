# Dostopnost

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`.

Projekt cilja na skladnost s standardom EN 301 549 v3.2.1, ki za spletni del uporablja WCAG 2.1 na nivoju AA.

## Pristop

- Vsak pogled ima glavno obmocje, naslov strani in preskok na glavno vsebino.
- Navigacija, obrazci, gumbi z ikonami, statusi, seznami pobud in analiticne tabele imajo dostopna imena ali semanticne oznake.
- Napake obrazcev so povezane s polji prek `aria-invalid` in `aria-describedby`.
- Obvestila aplikacije uporabljajo `role="status"` ali `role="alert"`.
- Vizualni grafi niso edini vir informacije; stevilske vrednosti so izpisane tudi kot besedilo.
- CSS podpira vidno tipkovnicno fokusno oznako, zmanjsano gibanje in osnovni forced-colors nacin.
- Uporabnik lahko na strani Dostopnost prilagodi velikost besedila, kontrast, razmik, gibanje, velikost gumbov in pisavo.

## Redno preverjanje

Pred vecjo oddajo preverite:

- navigacijo samo s tipkovnico,
- oznake novih obrazcev in napak,
- kontrast novih barv,
- bralnik zaslona pri novih interaktivnih komponentah,
- izvoz dokumentov, ce se razglasajo kot dostopni dokumenti.

## Znane omejitve

- Turnstile je zunanji gradnik in je odvisen od dostopnosti ponudnika.
- Brskalniski PDF izvoz je namenjen tiskanju in ni oznacen kot popolnoma dostopen PDF.
- DOCX in ODT izvoz imata osnovno strukturo, pred uradno objavo pa potrebujeta rocni pregled.
