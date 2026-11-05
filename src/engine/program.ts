// Loads the programme content from program/*.json. The engine knows no exercise by name: every
// rule works on the ids and tags in these files (docs/ENGINE.md section 1).
import meta from '../../program/program.json' with { type: 'json' };
import A from '../../program/sessions/A.json' with { type: 'json' };
import B from '../../program/sessions/B.json' with { type: 'json' };
import motor from '../../program/sessions/motor.json' with { type: 'json' };
import os from '../../program/sessions/os.json' with { type: 'json' };
import travel from '../../program/sessions/travel.json' with { type: 'json' };
import backpackRow from '../../program/tracks/backpack_row.json' with { type: 'json' };
import burpeeEmom from '../../program/tracks/burpee_emom.json' with { type: 'json' };
import burpeeSkill from '../../program/tracks/burpee_skill.json' with { type: 'json' };
import calf from '../../program/tracks/calf.json' with { type: 'json' };
import clubSequence from '../../program/tracks/club_sequence.json' with { type: 'json' };
import coreFront from '../../program/tracks/core_front.json' with { type: 'json' };
import coreRot from '../../program/tracks/core_rot.json' with { type: 'json' };
import coreSide from '../../program/tracks/core_side.json' with { type: 'json' };
import coreSitup from '../../program/tracks/core_situp.json' with { type: 'json' };
import groin from '../../program/tracks/groin.json' with { type: 'json' };
import legs from '../../program/tracks/legs.json' with { type: 'json' };
import neck from '../../program/tracks/neck.json' with { type: 'json' };
import posterior from '../../program/tracks/posterior.json' with { type: 'json' };
import powerLegs from '../../program/tracks/power_legs.json' with { type: 'json' };
import powerUpper from '../../program/tracks/power_upper.json' with { type: 'json' };
import press from '../../program/tracks/press.json' with { type: 'json' };
import pull from '../../program/tracks/pull.json' with { type: 'json' };
import shoulder from '../../program/tracks/shoulder.json' with { type: 'json' };
import slRdl from '../../program/tracks/sl_rdl.json' with { type: 'json' };
import wallsit from '../../program/tracks/wallsit.json' with { type: 'json' };
import bosses from '../../program/bosses.json' with { type: 'json' };
import heroes from '../../program/heroes.json' with { type: 'json' };
import impress from '../../program/impress.json' with { type: 'json' };
import measures from '../../program/measures.json' with { type: 'json' };
import overlays from '../../program/overlays.json' with { type: 'json' };
import pictos from '../../program/pictos.json' with { type: 'json' };
import routines from '../../program/routines.json' with { type: 'json' };
import sideBranches from '../../program/side_branches.json' with { type: 'json' };
import weeks from '../../program/weeks.json' with { type: 'json' };
import type {
  BoardRow,
  Boss,
  Measure,
  Overlay,
  PictoRef,
  Program,
  Requirement,
  Routine,
  SessionTemplate,
  Track,
  Week,
} from './types.ts';

/** JSON imports are typed loosely; the shapes are checked by program.spec.ts. */
function as<T>(value: unknown): T {
  return value as T;
}

export const PROGRAM: Program = {
  programVersion: meta.programVersion,
  startDate: meta.startDate,
  migrations: as<Record<string, string>>(meta.migrations),
  club: meta.club,
  // Order: the ten ladders, the power tracks, then the rest (as on page 11).
  tracks: as<Track[]>([
    press,
    shoulder,
    pull,
    legs,
    wallsit,
    posterior,
    coreFront,
    coreSide,
    coreRot,
    coreSitup,
    groin,
    powerLegs,
    powerUpper,
    burpeeEmom,
    burpeeSkill,
    clubSequence,
    neck,
    calf,
    slRdl,
    backpackRow,
  ]),
  sessions: as<SessionTemplate[]>([A, B, motor, os, travel]),
  routines: as<Routine[]>(routines),
  weeks: as<Week[]>(weeks),
  measures: as<Measure[]>(measures.measures),
  board: as<BoardRow[]>(measures.board),
  overlays: as<Overlay[]>(overlays),
  impress: as<Requirement[]>(impress),
  heroes: as<Requirement[]>(heroes),
  sideBranches: as<Requirement[]>(sideBranches),
  bosses: as<Boss[]>(bosses),
  pictos: as<Record<string, PictoRef>>(pictos),
};
