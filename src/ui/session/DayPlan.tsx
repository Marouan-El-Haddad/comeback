// »Dagens pas« (docs/SPEC.md 3.2, DECISIONS.md D50): the whole session on one screen before it
// starts – its parts in order with navy dividers and big red numbers, each exercise with its figure,
// sets × repetitions (or time), the pause, the equipment and the expected time – with »Start
// passet« at the bottom. A tap on an exercise opens its card.
import { equipmentText, type CardContext } from '../components/cardItem.ts';
import { formatDose } from '../../engine/format.ts';
import { getStep, getTrack } from '../../engine/lookup.ts';
import type { BlockPlan, SessionPlan } from '../../engine/plan.ts';
import { PROGRAM } from '../../engine/program.ts';
import type { Equipment } from '../../content/types.ts';
import { MEASURES } from '../../content/types.ts';
import { loadedExplain } from '../../content/load.ts';
import { loadedExplanation, subjectOf, useSubjects } from './exercise.ts';
import { ExerciseFigure } from './NowNext.tsx';
import { sessionSections, type Section } from './outline.ts';
import { isAlternating, type Step } from './steps.ts';

export interface DayItem {
  key: string;
  /** The card a tap opens and the figure comes from; null: nothing to open (a motor phase). */
  cardId: string | null;
  pictoId: string | null;
  kicker: string;
  name: string;
  dose: string;
  /** A line under the dose: the pause, the measurement. */
  notes: string[];
  context?: CardContext | null;
}

export interface DayPart {
  label: string;
  /** Under the part's name: »8 min«, how a pair runs. */
  note?: string;
  items: DayItem[];
}

const MEASURE_WHAT: Record<string, string> = {
  reps: 'Så mange som muligt',
  sec: 'Så længe du kan',
  cm: 'Afstand i cm',
  m: 'Distance i meter',
  depth: 'Så langt ned, du kan styre',
};

/** Sets × repetitions or time as the session runs them (a measurement set not counted). */
function blockDose(block: BlockPlan): string {
  if (block.unit === 'emom' && block.emom) {
    return `${block.emom.minutes} min · ${block.emom.reps} burpees i starten af hvert minut`;
  }
  if (block.unit === 'rounds') {
    const rounds = block.rounds ?? 1;
    const word = rounds === 1 ? 'runde' : 'runder';
    return block.sets > 1 ? `${block.sets} × ${rounds} ${word}` : `${rounds} ${word}`;
  }
  if (block.role === 'neck') return formatDose(getStep(PROGRAM, block.stepId).dose);
  const unit = block.unit === 'sec' ? ' sek' : '';
  const per = block.per ? ` pr. ${block.per}` : '';
  // Skater-hop and split jumps: both sides in one set (P54).
  const alternately = isAlternating(block) ? ', skiftevis' : '';
  return `${block.sets} × ${block.target}${unit}${per}${alternately}`;
}

function measureName(id: string | undefined): string {
  return PROGRAM.measures.find((m) => m.id === id)?.name ?? '';
}

function blockItem(block: BlockPlan, kind: SessionPlan['kind']): DayItem {
  if (block.role === 'measure') {
    const measure = PROGRAM.measures.find((m) => m.id === block.measureId);
    return {
      key: block.blockId,
      cardId: `${MEASURES}.${block.measureId ?? ''}`,
      pictoId: null,
      kicker: 'Måling',
      name: measure?.name ?? '',
      dose: MEASURE_WHAT[measure?.unit ?? ''] ?? '',
      notes: [],
    };
  }
  const stepId = block.emom?.stepId ?? block.stepId;
  const step = getStep(PROGRAM, stepId);
  const notes: string[] = [];
  if (block.measureId) notes.push(`Første sæt er en måling: ${measureName(block.measureId)}`);
  if (block.unit !== 'emom' && block.role !== 'neck' && block.restSec > 0) {
    notes.push(`Pause ${block.restSec} sek`);
  }
  if (block.tempDown?.lighter) notes.push('Lettere variant i dag');
  return {
    key: block.blockId,
    cardId: stepId,
    pictoId: stepId,
    kicker: `${getTrack(PROGRAM, block.trackId).short} · trin ${step.key}`,
    name: step.name,
    dose: blockDose(block),
    notes,
    context: block.tempDown?.lighter ? { session: kind, power: null, lighter: true } : null,
  };
}

const PAIRED = /^(Par \d|Tri-sæt)$/;

/**
 * A strength session's parts as the session runs them: the wall test and the warm-up first, then
 * each part of the session's steps with its exercises in order (docs/SPEC.md 3.2).
 */
export function strengthParts(
  plan: SessionPlan,
  steps: readonly Step[],
  wallTest: boolean,
): { parts: DayPart[]; sections: Section[] } {
  const warmup = PROGRAM.routines.find((r) => r.id === 'warmup');
  const power = plan.blocks.find((b) => b.role === 'power');
  const sections = sessionSections(steps, { wallTest, warmup: !!warmup });
  const parts = sections.map((section): DayPart => {
    if (section.pre === 'wallTest') {
      return {
        label: 'Måling',
        note: 'Før opvarmningen',
        items: [
          {
            key: 'wall_test',
            cardId: `${MEASURES}.wall_test`,
            pictoId: null,
            kicker: 'Måling',
            name: measureName('wall_test'),
            dose: MEASURE_WHAT.cm ?? '',
            notes: [],
          },
        ],
      };
    }
    if (section.pre === 'warmup') {
      const context: CardContext = { session: plan.kind, power: power?.stepId ?? null };
      return {
        label: 'Opvarmning',
        note: '8 min · uret skifter selv',
        items: (warmup?.items ?? []).map((item) => ({
          key: `warmup.${item.key}`,
          cardId: `warmup.${item.key}`,
          pictoId: null,
          kicker: '',
          name: item.name,
          dose: item.dose,
          notes:
            item.key === '4' && power
              ? [`Dagens første power-øvelse: ${getStep(PROGRAM, power.stepId).name}`]
              : [],
          context,
        })),
      };
    }
    const blocks: BlockPlan[] = [];
    for (const step of steps.slice(section.from, section.to + 1)) {
      if (!('block' in step)) continue;
      if (!blocks.includes(step.block)) blocks.push(step.block);
    }
    return {
      label: section.label,
      note: PAIRED.test(section.label)
        ? 'Et sæt af hver øvelse efter tur, med pause imellem'
        : undefined,
      items: blocks.map((b) => blockItem(b, plan.kind)),
    };
  });
  return { parts, sections };
}

/** The motor's phases as parts: what to run and how long (docs/SPEC.md 4.5). */
export function motorParts(plan: SessionPlan): DayPart[] {
  const motor = plan.motor;
  if (!motor) return [];
  // A phase is its name and its time; the session counts the phases and the measurement as one
  // row (»Fase 1 af 2«), so the numbers here are the same.
  const parts: DayPart[] = motor.phases.map((phase) => ({
    label: phase.label,
    note: phase.seconds > 0 ? clock(phase.seconds) : 'Til du trykker videre',
    items: [],
  }));
  if (motor.measureId) {
    parts.push({
      label: 'Måling',
      note: motor.cooperOptional ? 'Valgfri' : undefined,
      items: [
        {
          key: motor.measureId,
          cardId: `${MEASURES}.${motor.measureId}`,
          pictoId: null,
          kicker: 'Måling',
          name: measureName(motor.measureId),
          dose: MEASURE_WHAT.m ?? '',
          notes: [],
        },
      ],
    });
  }
  return parts;
}

/** »10 min«, »45 sek«, »1 min 30 sek«. */
function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} sek`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sek`;
}

/** The equipment of every exercise in the parts, from the explanations that have come. */
function equipmentOf(parts: readonly DayPart[]): Equipment[] {
  const all = new Set<Equipment>();
  for (const part of parts) {
    for (const item of part.items) {
      if (!item.cardId) continue;
      for (const e of loadedExplanation(item.cardId)?.equipment ?? []) all.add(e);
    }
  }
  return [...all];
}

function ItemRow({ item, onCard }: { item: DayItem; onCard: (item: DayItem) => void }) {
  const equipment = item.cardId ? (loadedExplanation(item.cardId)?.equipment ?? []) : [];
  const body = (
    <>
      <ExerciseFigure
        cardId={item.cardId}
        pictoId={item.pictoId}
        name={item.name}
        context={item.context ?? null}
        size="plan"
        still
      />
      <span class="day-item-text">
        {item.kicker && <span class="step-kicker">{item.kicker}</span>}
        <span class="day-item-name">{item.name}</span>
        <span class="day-item-dose">{item.dose}</span>
        {item.notes.map((note) => (
          <span key={note}>{note}</span>
        ))}
        {equipment.length > 0 && <span>Udstyr: {equipmentText(equipment)}</span>}
        {item.cardId && <span class="day-item-how">Sådan gør du</span>}
      </span>
    </>
  );
  if (!item.cardId) return <div class="day-item">{body}</div>;
  return (
    <button type="button" class="day-item" onClick={() => onCard(item)}>
      {body}
    </button>
  );
}

/** The parts with their numbers and exercises; also Open & Strong's list (src/ui/session/OpenStrong.tsx). */
export function DayParts({
  parts,
  onCard,
  numbered = true,
}: {
  parts: readonly DayPart[];
  onCard: (item: DayItem) => void;
  numbered?: boolean;
}) {
  return (
    <>
      {parts.map((part, i) => (
        <section class="day-part" key={`${i}-${part.label}`}>
          <div class="day-part-head">
            {numbered && <span class="day-part-number">{i + 1}</span>}
            <div class="day-part-title">
              <h2>{part.label}</h2>
              {part.note && <p class="day-part-note">{part.note}</p>}
            </div>
          </div>
          {part.items.length > 0 && (
            <ul class="day-items">
              {part.items.map((item) => (
                <li key={item.key}>
                  <ItemRow item={item} onCard={onCard} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

/**
 * »Dagens pas«: the session's name, the expected time and the equipment, the parts, and »Start
 * passet« at the bottom. The figures and the equipment come from content/ as it is fetched.
 */
export function DayPlan({
  title,
  minutes,
  parts,
  hint,
  strength = true,
  onCard,
}: {
  title: string;
  minutes: number;
  parts: readonly DayPart[];
  hint?: string;
  /** A strength session counts its exercises and their equipment; the motor has its phases. */
  strength?: boolean;
  onCard: (item: DayItem) => void;
}) {
  const subjects = parts.flatMap((p) =>
    p.items.flatMap((i) => (i.cardId ? [subjectOf(i.cardId)] : [])),
  );
  useSubjects(subjects);
  // The equipment is told once every explanation has come, never »Kun gulvet« while they load.
  const ready = subjects.every((s) => loadedExplain(s) !== undefined);
  const equipment = equipmentOf(parts);
  const exercises = parts.reduce((n, p) => n + p.items.filter((i) => i.cardId).length, 0);
  return (
    <div class="day-plan" data-testid="day-plan">
      <header class="day-plan-facts">
        <h1>{title}</h1>
        <p class="day-plan-time">ca. {minutes} min</p>
        <p>
          {parts.length} {parts.length === 1 ? 'del' : 'dele'}
          {strength && exercises > 0
            ? ` · ${exercises} ${exercises === 1 ? 'øvelse' : 'øvelser'}`
            : ''}
        </p>
        {strength && exercises > 0 && ready && (
          <p data-testid="day-equipment">Udstyr: {equipmentText(equipment)}</p>
        )}
        {hint && <p class="hint">{hint}</p>}
      </header>
      <DayParts parts={parts} onCard={onCard} />
    </div>
  );
}
