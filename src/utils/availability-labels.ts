import type {
  AvailabilityChannel, AvailabilityOutlook, AvailabilityVerdict, ChannelId,
} from "../api/types-releases";
import { formatAirDateShort, parseAirDate } from "./episode-dates";
import { KIND_STYLE } from "./calendar-kind";

/**
 * Le vocabulaire des canaux de sortie, en un seul endroit.
 *
 * Les couleurs sont empruntées à l'agenda (`calendar-kind.ts`) : une sortie
 * numérique doit avoir la même teinte sur une carte du catalogue et dans le
 * calendrier, sinon les deux écrans parlent de la même chose sans en avoir
 * l'air. Les deux tables divergeaient — celle-ci fait désormais autorité pour
 * les deux, en réutilisant les mêmes jetons de statut.
 *
 * Le mot « Disponible » est proscrit : sur Mes demandes il signifie « dans ta
 * bibliothèque ». On nomme le canal, jamais l'état de possession.
 */

/** « 3 sept. » — l'année n'est utile que si la sortie déborde sur l'an prochain. */
export function shortDate(date: string): string {
  const parsed = parseAirDate(date);
  if (!parsed) return date;
  const full = formatAirDateShort(date);
  return parsed.getFullYear() === new Date().getFullYear()
    ? full.replace(/\s*\d{4}$/, "").replace(/,\s*$/, "")
    : full;
}

/** Le canal emprunte la teinte que l'agenda donne déjà au même événement. */
export const CHANNEL_STYLE: Record<ChannelId, string> = {
  physical: KIND_STYLE.physical.chip,
  digital: KIND_STYLE.digital.chip,
  theatrical: KIND_STYLE.theatrical.chip,
};

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/*
 * Deux registres par canal : le libellé COURT tient sous une affiche de grille
 * (une poignée de caractères, sans date quand elle est passée — « depuis le
 * 25 juin » n'apprend rien à qui veut juste savoir si ça existe), le libellé
 * LONG est une phrase complète pour la fiche détaillée et l'infobulle.
 */
const SHORT: Record<ChannelId, { out: string; soon: string }> = {
  physical: { out: "seer:availPhysicalOut", soon: "seer:availPhysicalSoon" },
  digital: { out: "seer:availDigitalOut", soon: "seer:availOnlineOn" },
  theatrical: { out: "seer:availStillInTheaters", soon: "seer:availTheatricalSoon" },
};

const LONG: Record<ChannelId, { out: string; soon: string }> = {
  physical: { out: "seer:availPhysicalOutLong", soon: "seer:availPhysicalSoonLong" },
  digital: { out: "seer:availDigitalOutLong", soon: "seer:availOnlineOnLong" },
  theatrical: { out: "seer:availInTheatersLong", soon: "seer:availTheatricalSoonLong" },
};

export function channelLabel(channel: AvailabilityChannel, t: Translate, long = false): string {
  const table = long ? LONG : SHORT;
  const key = channel.released ? table[channel.id].out : table[channel.id].soon;
  return t(key, { date: shortDate(channel.date) });
}

const OUTLOOK_I18N: Record<AvailabilityOutlook, string> = {
  likely: "seer:availOutlookLikely",
  unlikely: "seer:availOutlookUnlikely",
  not_yet: "seer:availOutlookNotYet",
};

/**
 * La phrase qui répond à « est-ce que ça va marcher ? ». On oriente sans jamais
 * promettre : aucun pourcentage, aucun engagement — seulement ce que la
 * présence ou l'absence d'une sortie hors salle laisse raisonnablement espérer.
 */
export function outlookLabel(verdict: AvailabilityVerdict, t: Translate): string | null {
  /* Un titre sans le moindre canal connu n'a rien à dire : se taire vaut mieux
   * que rassurer à tort tout le catalogue ancien. */
  if (verdict.channels.length === 0) return null;
  return t(OUTLOOK_I18N[verdict.outlook]);
}

/**
 * Y a-t-il quelque chose à afficher ?
 *
 * Garde UNIQUE, partagée par la pastille et par la fiche détaillée. Le piège
 * qu'elle évite : un film sorti en Blu-ray porte `kind: "released"` tout en
 * ayant des canaux à montrer — tester `kind !== "released"`, comme on le
 * faisait, le faisait disparaître précisément dans le cas qui nous intéresse.
 */
export function hasSignal(verdict: AvailabilityVerdict | null | undefined): boolean {
  if (!verdict) return false;
  return (verdict.channels?.length ?? 0) > 0 || verdict.kind === "not_aired";
}

/**
 * Les canaux qu'une carte de grille peut montrer sans casser la mise en page.
 * Deux lignes au maximum : au-delà, la colonne devient un pavé de texte et les
 * rangées de la grille se décalent les unes par rapport aux autres.
 */
export function cardChannels(verdict: AvailabilityVerdict): AvailabilityChannel[] {
  return (verdict.channels ?? []).slice(0, 2);
}

/** L'infobulle dit tout ce que la carte a dû laisser de côté. */
export function verdictTooltip(verdict: AvailabilityVerdict, t: Translate): string {
  const lines = verdict.channels.map((c) => channelLabel(c, t, true));
  const outlook = outlookLabel(verdict, t);
  if (outlook) lines.push(outlook);
  return lines.join(" — ");
}
