# Binnen Display (standalone)

Statische versie van het Nest Hub-dashboard: klok, gebedstijden Leiden, weer, Hijri-datum, wisselende foto's en adhaan.
Geen server, geen Mac, geen Node nodig. Alles draait in de browser; hosting kan op elke statische host (bijv. GitHub Pages).
Geen aanbel/camera in deze versie.

## Hoe het werkt
- **Gebedstijden:** `vendor/adhan.umd.min.js` (npm `adhan` 4.4.6, MIT), Muslim World League, Leiden (52.1601, 4.4970), `HighLatitudeRule.recommended`, kalenderdag in Europe/Amsterdam. Zelfde berekening als `src/dashboard.js`; na middernacht opnieuw berekend.
- **Weer:** rechtstreeks van Open-Meteo, elke 15 min; bij een fout blijft de laatste waarde staan.
- **Achtergronden:** `backgrounds/licht|donker`, lijst staat in `app.js` (`BGS`). Eén vaste foto per gebedstijd (`prayer` in `BGS`): Fajr skyline, Dhuhr gracht, Asr Hooglandse Kerk, Maghrib zonsondergang, Isha nacht; wisselt binnen 30 s na elk gebed. Het accent wordt per foto afgeleid.
- **Adhaan:** de pagina plant zelf Fajr, Dhuhr, Asr, Maghrib en Isha (binnen 2 min na de tijd), toont een schermvullende overlay en speelt `adhan.mp3`. Tik = stoppen; stopt vanzelf na het einde (veiligheidstimer 170 s). Volume kan niet vanuit de pagina; stel dat op de hub zelf in. Als de browser audio weigert (autoplay), blijft de overlay zonder geluid staan en staat er een waarschuwing in de console. Op de Nest Hub via DashCast mag audio wel zonder klik.
- **Nachtelijke herlaad:** om ~03:30 (Amsterdam) herlaadt de pagina zichzelf, zodat nieuwe versies binnenkomen (niet tijdens een adhaan).
- **Lettertype:** Source Sans 3 (SIL OFL 1.1), lokaal in `fonts/` met `fonts/OFL.txt`. Gewichten: 300 klok, 400 tekst, 600 labels, 700 nadruk.

## Testen
```
cd standalone
python3 -m http.server 8123
```
- `http://localhost:8123/` normaal
- `http://localhost:8123/?test=adhan` speelt direct een test-adhaan (in een gewone browser blokkeert autoplay mogelijk het geluid)
- `http://localhost:8123/?test=bg` loopt alle foto's door, 8 s per stuk

## Casten naar de Nest Hub
Pagina's moeten via https bereikbaar zijn (bijv. GitHub Pages).
```
catt -d "<naam van de hub>" cast_site https://<gebruiker>.github.io/<repo>/
```
Of via DashCast zoals `src/cast.js` in de bestaande server (receiver 84912283, URL van de statische pagina).

## Let op voor publiceren
- `adhan.mp3` (opname Sabah Fakhri, 2,5 MB): rechten niet vastgelegd. Controleer of publiceren mag.
- De 5 foto's hebben geen auteur/licentie in het manifest. Vul `author`/`license` in `BGS` (app.js) in zodra bekend; het fotocredit toont ze automatisch.
- Adobe Clean is bewust niet meegenomen (licentie).
