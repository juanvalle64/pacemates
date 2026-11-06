/**
 * Betreiberangaben für Impressum und Datenschutzerklärung.
 * Vor dem Launch unter pacemates.de mit echten Daten füllen und rechtlich prüfen lassen.
 * Solange `reviewed` false ist, zeigen beide Seiten einen sichtbaren Entwurfshinweis.
 */
export const operator = {
  /** Vollständiger Name oder Firma. */
  name: '',
  /** Ladungsfähige Anschrift, eine Zeile je Eintrag. Kein Postfach. */
  address: [] as string[],
  email: '',
  /** Optional, aber ein zweiter schneller Kontaktweg neben E-Mail wird oft verlangt. */
  phone: '',
  /** Nur falls vorhanden. */
  vatId: '',
  /** Verantwortlich für journalistisch-redaktionelle Inhalte, falls es solche gibt (§ 18 Abs. 2 MStV). */
  editorialResponsible: '',
  /** Wo die Seite liegt. Muss zum tatsächlichen Hosting passen. */
  hosting: {
    name: 'GitHub Pages',
    company: 'GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA',
    privacyUrl: 'https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement',
  },
  /** Wo der Strava-Token-Proxy läuft, falls er betrieben wird. */
  tokenProxy: {
    name: 'Cloudflare Workers',
    company: 'Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA',
    privacyUrl: 'https://www.cloudflare.com/de-de/privacypolicy/',
  },
  /** Zuständige Datenschutz-Aufsichtsbehörde am Sitz des Betreibers. */
  supervisoryAuthority: '',
  /** Stand der Texte. */
  updated: '2026-11-05',
  /** Erst auf true setzen, wenn die Texte geprüft und die Angaben vollständig sind. */
  reviewed: false,
};

export function operatorComplete(): boolean {
  return Boolean(operator.name && operator.address.length > 0 && operator.email);
}
