/* ─────────────────────────────────────────────────────────────
 * Bundled demo projects — real .snd.json project files shipped
 * with the app and offered by file name in the Demo picker
 * (toolbar dropdown + splash screen).
 * ───────────────────────────────────────────────────────────── */
import circularRCSectionData from './Circular RC Section.snd.json';
import iSectionLTBData from './I-Setion_LTB.snd.json';

export interface DemoProject {
  /** Display name = file name without the .snd.json extension. */
  name: string;
  /** Original bundled file name. */
  fileName: string;
  /** Full project JSON text, ready for loadProject. */
  json: string;
}

function toDemoProject(fileName: string, data: unknown): DemoProject {
  return { name: fileName.replace(/\.snd\.json$/i, ''), fileName, json: JSON.stringify(data) };
}

export const DEMO_PROJECTS: DemoProject[] = [
  toDemoProject('Circular RC Section.snd.json', circularRCSectionData),
  toDemoProject('I-Setion_LTB.snd.json', iSectionLTBData),
];
