import { useState } from 'react';
import { formatPaceInput, parsePaceInput } from '../lib/format.ts';
import type { AthleteProfile } from '../lib/types.ts';

function NumericField({
  label,
  value,
  min,
  max,
  suffix,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  suffix: string;
  onCommit: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [error, setError] = useState('');
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        value={text}
        placeholder={suffix}
        onChange={(event) => {
          setText(event.target.value);
          setError('');
        }}
        onBlur={() => {
          if (!text.trim()) {
            setError('');
            onCommit(undefined);
            return;
          }
          const parsed = Number(text);
          if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
            setError(`Zwischen ${min} und ${max}.`);
            return;
          }
          setError('');
          onCommit(parsed);
        }}
      />
      {error ? <em className="field-error">{error}</em> : <em>{suffix}</em>}
    </label>
  );
}

export function ModelForm({ profile, onChange }: { profile: AthleteProfile; onChange: (patch: Partial<AthleteProfile>) => void }) {
  const [runPace, setRunPace] = useState(formatPaceInput(profile.runThresholdPaceSec));
  const [swimPace, setSwimPace] = useState(formatPaceInput(profile.swimThresholdPaceSec));
  const [runError, setRunError] = useState('');
  const [swimError, setSwimError] = useState('');

  function commitPace(kind: 'run' | 'swim', value: string) {
    if (!value.trim()) {
      onChange(kind === 'run' ? { runThresholdPaceSec: undefined } : { swimThresholdPaceSec: undefined });
      if (kind === 'run') setRunError('');
      else setSwimError('');
      return;
    }
    const seconds = parsePaceInput(value);
    const valid = kind === 'run'
      ? seconds !== undefined && seconds >= 150 && seconds <= 720
      : seconds !== undefined && seconds >= 45 && seconds <= 240;
    if (!valid || seconds === undefined) {
      const message = 'Format m:ss.';
      if (kind === 'run') setRunError(message);
      else setSwimError(message);
      return;
    }
    if (kind === 'run') {
      setRunError('');
      onChange({ runThresholdPaceSec: seconds });
    } else {
      setSwimError('');
      onChange({ swimThresholdPaceSec: seconds });
    }
  }

  return (
    <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
      <NumericField label="Maximale Herzfrequenz" value={profile.maxHr} min={120} max={230} suffix="bpm" onCommit={(maxHr) => onChange({ maxHr })} />
      <NumericField label="Ruheherzfrequenz" value={profile.restHr} min={30} max={100} suffix="bpm" onCommit={(restHr) => onChange({ restHr })} />
      <NumericField label="FTP" value={profile.ftp} min={50} max={600} suffix="Watt" onCommit={(ftp) => onChange({ ftp })} />
      <fieldset className="field">
        <legend>TRIMP-Faktor</legend>
        <label className="check"><input type="radio" name="trimp" checked={profile.trimpK === 1.92} onChange={() => onChange({ trimpK: 1.92 })} /> 1,92, übliche Voreinstellung</label>
        <label className="check"><input type="radio" name="trimp" checked={profile.trimpK === 1.67} onChange={() => onChange({ trimpK: 1.67 })} /> 1,67, Alternative derselben Formel</label>
      </fieldset>
      <label className="field">
        <span>Schwellenpace Laufen</span>
        <input value={runPace} placeholder="m:ss" inputMode="numeric" onChange={(event) => setRunPace(event.target.value)} onBlur={() => commitPace('run', runPace)} />
        {runError ? <em className="field-error">{runError}</em> : <em>Minuten je Kilometer</em>}
      </label>
      <label className="field">
        <span>Schwellenpace Schwimmen</span>
        <input value={swimPace} placeholder="m:ss" inputMode="numeric" onChange={(event) => setSwimPace(event.target.value)} onBlur={() => commitPace('swim', swimPace)} />
        {swimError ? <em className="field-error">{swimError}</em> : <em>Minuten je 100 m</em>}
      </label>
    </form>
  );
}
