# PaceMates – Designsystem „Startnummer“

Stand: 6. November 2026. Ersetzt die frühere Richtung „Bahn und Kreide“.

## Idee

PaceMates sieht aus wie eine Startnummer: Tyvek-Weiß, Startnummer-Schwarz, ein kräftiges Signalblau als Farbfeld, vier Nadellöcher, ein perforierter Abschnitt unten. Das Motiv kommt aus der Welt, die jeder Ausdauersportler kennt, nicht aus einem Software-Baukasten.

**Bewusst vermieden** (typische Muster generierter Seiten): Cremegrund mit Terrakotta-Akzent, schmale Versal-Überschriften, kleine Labels über jeder Überschrift, gleich große Icon-Karten als Seitenraster, farbige Seitenstreifen an Karten und Hinweisen, Verläufe und Glas-Effekte.

## Farben

| Rolle | Hell | Dunkel |
| --- | --- | --- |
| Grund | `#eef0f4` | `#0a0c10` |
| Fläche | `#ffffff` | `#13161d` |
| Schrift | `#0b0d12` | `#eef1f6` |
| Gedämpft | `#4a5163` | `#a6adbd` |
| Linie | `#dde1e8` | `#262b36` |
| Bedienrand | `#7b8293` | `#6b7385` |
| Signalblau (Fläche, Knopf) | `#1f3dff` | `#3b56ff` |
| Signalblau als Text | `#1f3dff` | `#8fa2ff` |
| Laufen / Rad / Schwimmen / Kombi | `#c2410c` `#0f7a45` `#0e7490` `#7c3aed` | `#ff8a4c` `#4cc38a` `#38bdf8` `#b794f6` |
| Fitness / Ermüdung / Form | Blau / Orange / Grün | dto. aufgehellt |
| Gut / Achtung / Kritisch | `#0f7a45` `#9a4a07` `#c0262d` | `#4cc38a` `#f5a524` `#ff6b6b` |

Text ≥ 4,5:1, Bedienelemente ≥ 3:1 in beiden Modi. Farbstrategie: Die Landing ist „committed“ (Signalblau trägt Hero und Datenschutz-Band). Die App ist zurückhaltend: neutrale Flächen, Blau nur für Aktion, Auswahl und die Form-Startnummer.

## Schrift

Eine Familie: **Archivo** (variabel, lokal eingebunden über `@fontsource-variable/archivo`).

- Überschriften und große Zahlen: Breite 125 %, Gewicht 800, Laufweite −0,025 em. Erinnert an aufgedruckte Startnummern.
- Kartentitel, Kennzahlen: Breite 112 %, Gewicht 700–800.
- Text und Bedienung: Breite 100 %, Gewicht 400–650, 16 px Basis.
- Zahlen immer tabellarisch.

## Bausteine

- **Startnummer (`Bib`)**: Farbband oben, Nadellöcher, optional perforierter Abschnitt. Auf der Landing trägt sie Überschrift und das echte Ablagefeld. In der App ist sie das eine Erkennungszeichen: die heutige Form (TSB) als große Nummer, daneben Fitness und Ermüdung (`FormBib`). Sie zeigt nur gerechnete Werte.
- **Knöpfe**: primär Signalblau, sekundär weiß mit Linie, Strava im Strava-Orange, Gefahr als roter Rahmen.
- **Pillen** für Status (Sofort, Im Gleichgewicht, Wichtig …), farbig nur bei Bedeutung.
- **Hinweise**: getönte Fläche statt Seitenstreifen (Achtung, Gut, Aktion).
- **Karten**: weiße Fläche, 1 px Linie, weicher Schatten mit Versatz, 12 px Radius.
- **Tabs**: Text mit Signalblau-Unterstrich, der beim Wechsel einläuft.
- **Listen statt Kartenraster** auf der Landing: Ansichten und Datenquellen als Zeilen mit Haarlinien.
- Icons: `lucide-react`, Strichstärke 2–2,2.

## Bewegung

Ein einziger gestalteter Moment: Die Startnummer im Hero „wird angepinnt“ (leicht schräg, setzt sich). Sonst nur kurze Zustandsübergänge. `prefers-reduced-motion` schaltet alles ab.

## Browserflächen

Textauswahl, Fokusrahmen, Cursorfarbe, Scrollbar und Checkbox-Akzent kommen aus der Palette.

## Dateien

- Tokens und Komponenten: `src/styles.css`
- Logo, Startnummer, Themenschalter: `src/components/Brand.tsx`, `src/components/FormBib.tsx`
- Favicon: `public/favicon.svg`; Teilen-Bild und Launch-Grafiken: `marketing/` (neu rendern mit `node marketing/render.cjs`)
