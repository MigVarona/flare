'use client';

export const Signals = [
  { id: 'parpadeo', glyph: '◉', name: 'Parpadeo', meaning: 'Te he leído' },
  { id: 'chispazo', glyph: '✦', name: 'Chispazo', meaning: 'Me ha hecho gracia' },
  { id: 'bengala', glyph: '☀', name: 'Bengala', meaning: '¡Toma ya!' },
  { id: 'apagon', glyph: '◌', name: 'Apagón', meaning: 'Me he quedado sin palabras' },
  { id: 'corto', glyph: 'ϟ', name: 'Cortocircuito', meaning: 'Me ha explotado la cabeza' },
  { id: 'fundido', glyph: '∞', name: 'Fundido', meaning: 'Estoy aquí' },
] as const;

export type SignalId = (typeof Signals)[number]['id'];

export function isSignalId(value: unknown): value is SignalId {
  return Signals.some((signal) => signal.id === value);
}

export function SignalMark({
  id,
  color,
  onClick,
}: {
  id: SignalId;
  color: string;
  onClick?: () => void;
}) {
  const signal = Signals.find((candidate) => candidate.id === id);
  if (!signal) return null;
  return (
    <button
      className="signal-mark"
      type="button"
      style={{ '--signal-color': color } as React.CSSProperties}
      title={`${signal.name}: ${signal.meaning}`}
      aria-label={`${signal.name}: ${signal.meaning}`}
      onClick={onClick}>
      {signal.glyph}
    </button>
  );
}

export function SignalPicker({
  current,
  onPick,
  onClose,
}: {
  current: SignalId | null;
  onPick: (signal: SignalId | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop signal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card signal-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Responder con una señal"
        onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        <p className="eyebrow">RESPONDE CON LUZ</p>
        <h2>Elige una señal</h2>
        <div className="signal-options">
          {Signals.map((signal) => (
            <button
              className={current === signal.id ? 'signal-option selected' : 'signal-option'}
              type="button"
              onClick={() => onPick(current === signal.id ? null : signal.id)}
              key={signal.id}>
              <i>{signal.glyph}</i>
              <span>
                <strong>{signal.name}</strong>
                <small>{signal.meaning}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
