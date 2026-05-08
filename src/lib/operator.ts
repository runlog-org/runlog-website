// Single source for operator / controller identity used across the German
// regulatory pages (Impressum, Datenschutz). Postal address must come from
// the operator and never be invented; per the Legal & Compliance decision
// (2026-05-03) the operator runs as a sole proprietor in Germany — DDG §5,
// DSGVO Art. 13/14, TDDDG §25 and DSGVO Art. 6 are always-applicable, so
// keeping these strings in one place avoids drift between pages and lets
// future paid-tier work (BFSG, /barrierefreiheit/) re-use the same source.

export const OPERATOR_NAME = 'Volker Otto';
export const OPERATOR_STREET = 'Glashütter Kirchenweg 25';
export const OPERATOR_POSTCODE = '22851';
export const OPERATOR_CITY = 'Norderstedt';
export const OPERATOR_COUNTRY_DE = 'Deutschland';
export const OPERATOR_COUNTRY_EN = 'Germany';

/** Postal block as a list of lines (e.g. for `<address>` rendering with
 *  `<br>` separators). The English vs. German variants only differ in the
 *  country line; everything else is the same. */
export const OPERATOR_ADDRESS_LINES_EN: readonly string[] = [
  OPERATOR_NAME,
  OPERATOR_STREET,
  `${OPERATOR_POSTCODE} ${OPERATOR_CITY}`,
  OPERATOR_COUNTRY_EN,
];

export const OPERATOR_ADDRESS_LINES_DE: readonly string[] = [
  OPERATOR_NAME,
  OPERATOR_STREET,
  `${OPERATOR_POSTCODE} ${OPERATOR_CITY}`,
  OPERATOR_COUNTRY_DE,
];

/** Email used on the public site for both general contact and
 *  data-protection enquiries. Schema.org Organization uses runlog@…; the
 *  controller-side mailbox is hello@… (the operator's personal address,
 *  which is the one filed in the Impressum). */
export const OPERATOR_EMAIL = 'hello@volkerotto.net';

/** Place of establishment — used in the Datenschutz Art. 77 supervisory
 *  authority paragraph and any future BFSG/Barrierefreiheit page that
 *  needs to declare jurisdiction. */
export const OPERATOR_STATE_DE = 'Schleswig-Holstein';
