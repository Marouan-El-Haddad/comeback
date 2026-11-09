// The club log, the Sunday check (docs/SPEC.md 4.6 and 4.7, DECISIONS.md D63) and »Flyt eller spring
// over« (3.1, 3.4, D64): screens shown in place of I dag or Uge with »Tilbage«, never a dialog.
// Fetched after start with lazy(). A button that saves takes the screen from its first tap until
// the tab is back, so a double tap saves once (D61).
import { useId, useState } from 'preact/hooks';
import {
  addDays,
  calendarWeek,
  formatLong,
  getStep,
  getTrack,
  mondayOf,
  PROGRAM,
  submitSundayCheck,
  weekday,
  weekdayName,
  weekInfoAt,
} from '../../engine/index.ts';
import type {
  AppEvent,
  ClubContent,
  EventBody,
  Freshness,
  Hardness,
  ISODate,
} from '../../engine/types.ts';
import {
  clubDay,
  clubLogOn,
  CONTENT,
  FRESHNESS,
  HARDNESS,
  hoursText,
  type LifeRequest,
} from '../life.ts';
import { useWriteOnce } from '../hooks.ts';
import type { Model } from '../model.ts';
import {
  filmWeek,
  heavyChoices,
  lightPains,
  painChoices,
  parseSleep,
  readyLadders,
} from './choices.ts';
import { Head } from './Head.tsx';
import { MoveForm } from './MoveForm.tsx';

export interface LifeFormProps {
  request: LifeRequest;
  model: Model;
  onClose: () => void;
  /** Called once the events are written, with the line the tab shows (»✓ …«); the tab comes back. */
  onSaved: (message?: string) => void;
}

export function LifeForm(props: LifeFormProps) {
  const request = props.request;
  switch (request.kind) {
    case 'club':
      return <ClubLogForm {...props} date={request.date} />;
    case 'sunday':
      return <SundayCheckForm {...props} sunday={request.sunday} />;
    case 'move':
      return <MoveForm {...props} session={request.session} date={request.date} />;
  }
}

const GRADES: Array<[number, string]> = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, String(n)]);

/**
 * A row of toggle buttons under a label: several can be chosen (`multiple`), otherwise one or none
 * – a tap on the chosen one removes the choice. A chosen button is filled navy with aria-pressed.
 */
function Toggles<T extends string | number>(props: {
  label: string;
  options: Array<[T, string]>;
  value: readonly T[];
  multiple?: boolean;
  columns?: 2 | 3 | 5;
  /** A group under a question (»Styrke A« under »Hvilken øvelse?«): a quieter label. */
  sub?: boolean;
  onChange: (value: T[]) => void;
}) {
  const id = useId();
  return (
    <section class="life-section">
      <p class={props.sub ? 'life-label sub' : 'life-label'} id={id}>
        {props.label}
      </p>
      <div class={`toggles cols-${props.columns ?? 3}`} role="group" aria-labelledby={id}>
        {props.options.map(([value, text]) => {
          const on = props.value.includes(value);
          return (
            <button
              key={String(value)}
              type="button"
              class={on ? 'btn selected' : 'btn'}
              aria-pressed={on}
              onClick={() =>
                props.onChange(
                  on
                    ? props.value.filter((v) => v !== value)
                    : props.multiple
                      ? [...props.value, value]
                      : [value],
                )
              }
            >
              {text}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// The club log (4.6)

function ClubLogForm(props: LifeFormProps & { date: ISODate }) {
  const { model, date } = props;
  const time = clubDay(PROGRAM, model.state, date)?.time;
  const saturday = weekday(date) === 6;
  const [content, setContent] = useState<ClubContent[]>([]);
  const [hardness, setHardness] = useState<Hardness[]>([]);
  const [freshness, setFreshness] = useState<Freshness[]>([]);
  const [technique, setTechnique] = useState<number[]>([]);
  const { busy, run } = useWriteOnce();
  // The club day's date, also when it is logged the day after (ENGINE 3.1).
  const save = (body: EventBody) =>
    run(async () => {
      await model.commit([model.ctx.make(body, date)]);
      props.onSaved();
    });
  // The content in the chips' order, whatever order they were tapped in.
  const chosen = (Object.keys(CONTENT) as ClubContent[]).filter((c) => content.includes(c));
  const logged: EventBody = {
    type: 'club_logged',
    attended: true,
    ...(chosen.length > 0 ? { content: chosen } : {}),
    ...(hardness[0] ? { hardness: hardness[0] } : {}),
    ...(freshness[0] ? { freshness: freshness[0] } : {}),
    ...(technique[0] !== undefined ? { technique: technique[0] } : {}),
  };
  const options = <K extends string>(names: Record<K, string>) =>
    (Object.keys(names) as K[]).map((key): [K, string] => [key, names[key]]);

  return (
    <div class="screen life" data-testid="club-log">
      <Head
        kicker={`Muay Thai · ${formatLong(date)}${time ? ` · ${time}` : ''}`}
        title="Hvordan var det?"
        onClose={props.onClose}
      />
      <button
        type="button"
        class="btn block"
        disabled={busy}
        data-testid="club-absent"
        onClick={save({ type: 'club_logged', attended: false })}
      >
        Jeg var der ikke
      </button>
      <Toggles
        label="Indhold"
        options={options(CONTENT)}
        value={content}
        multiple
        onChange={setContent}
      />
      <Toggles
        label="Hårdhed"
        options={options(HARDNESS)}
        value={hardness}
        onChange={setHardness}
      />
      <Toggles
        label="Overskud"
        options={options(FRESHNESS)}
        value={freshness}
        onChange={setFreshness}
      />
      {saturday && (
        <Toggles
          label="Teknikken i sidste runde"
          options={GRADES}
          value={technique}
          columns={5}
          onChange={setTechnique}
        />
      )}
      <p class="muted">Alt er valgfrit. Uden svar tæller træningen som mødt.</p>
      <button
        type="button"
        class="btn primary block"
        disabled={busy}
        data-testid="club-save"
        onClick={save(logged)}
      >
        Gem
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The Sunday check (4.7)

function SundayCheckForm(props: LifeFormProps & { sunday: ISODate }) {
  const { model, sunday } = props;
  const state = model.state;
  const weekStart = mondayOf(sunday);
  const saturday = addDays(sunday, -1);
  const earlier = state.sundayChecks.find((c) => c.weekStart === weekStart) ?? null;
  // Saturday's grade: from the club log when it is there, otherwise given here (D63).
  const satLog = clubLogOn(state, saturday);
  const gradeField = clubDay(PROGRAM, state, saturday) !== null && satLog?.attended !== false;
  const loggedGrade = satLog?.technique;

  const [sleep, setSleep] = useState(
    earlier?.sleepAvg !== undefined ? hoursText(earlier.sleepAvg) : '',
  );
  const [grade, setGrade] = useState<number[]>([]);
  const [hurts, setHurts] = useState((earlier?.painTracks.length ?? 0) > 0);
  const [pain, setPain] = useState<string[]>(earlier?.painTracks ?? []);
  const [heavy, setHeavy] = useState<string[]>(earlier?.tooHeavy ?? []);
  const { busy, run } = useWriteOnce();
  const sleepId = useId();

  const hours = parseSleep(sleep);
  const choose = painChoices(PROGRAM);
  const heavyIds = heavyChoices(PROGRAM, state, earlier?.tooHeavy ?? []);
  const ready = readyLadders(PROGRAM, state, weekStart);
  const light = lightPains(state, weekStart);
  const pw = weekInfoAt(PROGRAM, state, calendarWeek(state.startDate, sunday))?.pw;
  const missingPain = hurts && pain.length === 0;
  const canSave = hours !== 'invalid' && !missingPain;
  const short = (trackId: string) => getTrack(PROGRAM, trackId).short;
  const stepKey = (trackId: string) => {
    const t = state.tracks[trackId];
    return t ? getStep(PROGRAM, t.stepId).key : '';
  };

  const save = run(async () => {
    const extra: AppEvent[] = [];
    if (gradeField && loggedGrade === undefined && grade[0] !== undefined) {
      extra.push(
        model.ctx.make({ type: 'club_logged', attended: true, technique: grade[0] }, saturday),
      );
    }
    const check = submitSundayCheck(model.ctx, [...model.events, ...extra], {
      date: sunday,
      sleepAvg: typeof hours === 'number' ? hours : undefined,
      painTracks: hurts ? pain : [],
      tooHeavy: heavy,
    });
    await model.commit([...extra, ...check]);
    props.onSaved();
  });

  return (
    <div class="screen life" data-testid="sunday-check">
      <Head
        kicker={`${pw ? `Uge ${pw} · ` : ''}${formatLong(sunday)}`}
        title="Søndagstjek"
        onClose={props.onClose}
      />

      <section class="life-section">
        <label class="life-label" for={sleepId}>
          Timer søvn i snit
        </label>
        <input
          id={sleepId}
          class="life-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={sleep}
          onInput={(e) => setSleep((e.target as HTMLInputElement).value)}
        />
        {hours === 'invalid' && <p class="error-text">Skriv timerne som et tal, fx 7 eller 6,5.</p>}
      </section>

      {gradeField &&
        (loggedGrade !== undefined ? (
          <section class="life-section">
            <p class="life-label">Lørdagskarakter</p>
            <p class="life-value" data-testid="saturday-grade">
              <strong>{loggedGrade}</strong> · fra klubloggen
            </p>
          </section>
        ) : (
          <Toggles
            label="Lørdagskarakter: teknikken i sidste runde"
            options={GRADES}
            value={grade}
            columns={5}
            onChange={setGrade}
          />
        ))}

      <section class="life-section">
        {light.length > 0 && (
          <p class="hint">
            Let smerte i ugen:{' '}
            {light.map((p) => `${short(p.trackId)} ${weekdayName(weekday(p.date))}`).join(', ')}
          </p>
        )}
        <Toggles
          label="Gør noget ondt, der ikke gik væk?"
          options={[
            ['nej', 'Nej'],
            ['ja', 'Ja'],
          ]}
          value={[hurts ? 'ja' : 'nej']}
          columns={2}
          onChange={(v) => setHurts(v[0] === 'ja' || (v.length === 0 && hurts))}
        />
        {hurts && (
          <>
            <p class="life-label">Hvilken øvelse?</p>
            {choose.map((group) => (
              <Toggles
                key={group.title}
                label={group.title}
                sub
                options={group.trackIds.map((id): [string, string] => [id, short(id)])}
                value={pain}
                multiple
                columns={2}
                onChange={setPain}
              />
            ))}
            {missingPain ? (
              <p class="error-text">Vælg øvelsen, der gør ondt.</p>
            ) : (
              <p class="muted">
                Øvelsen går ét trin ned i en uge, og spørgsmål 2 står på »nej« før de næste pas.
              </p>
            )}
          </>
        )}
      </section>

      <section class="life-section" data-testid="ready">
        <p class="life-label">Klar til næste trin</p>
        {ready.length > 0 ? (
          <ul class="life-list">
            {ready.map((r) => (
              <li key={r.trackId}>
                <strong>{short(r.trackId)}</strong>: {r.text}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Ingen endnu. Et trin op kommer af sig selv efter to pas i træk på toppen med 2 i
            reserve.
          </p>
        )}
      </section>

      {heavyIds.length > 0 ? (
        <>
          <Toggles
            label="For tungt?"
            options={heavyIds.map((id): [string, string] => [
              id,
              `${short(id)} · trin ${stepKey(id)}`,
            ])}
            value={heavy}
            multiple
            columns={2}
            onChange={setHeavy}
          />
          <p class="muted">Den valgte stige går ét trin ned, når du gemmer – dit eget valg.</p>
        </>
      ) : (
        <section class="life-section">
          <p class="life-label">For tungt?</p>
          <p>Alle stiger står på første trin, så der er intet trin at gå ned til.</p>
        </section>
      )}

      {filmWeek(state, sunday) && (
        <p class="hint">
          Film dig selv fra siden i et sæt i denne uge. Kig efter svaj i lænden, en hofte der
          stikker op, albuer der flyver ud, og et hoved der skyder frem.
        </p>
      )}

      <button
        type="button"
        class="btn primary block"
        disabled={busy || !canSave}
        data-testid="sunday-save"
        onClick={save}
      >
        Gem søndagstjekket
      </button>
    </div>
  );
}
