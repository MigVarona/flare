'use client';

import { es } from 'react-day-picker/locale';
import { DayPicker } from 'react-day-picker';
import { useEffect, useMemo, useRef, useState } from 'react';

type ReminderDateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  min?: Date;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(date.getTime()) ? null : date;
}

function suggestedDate(min: Date) {
  const date = new Date(Math.max(Date.now(), min.getTime()));
  date.setSeconds(0, 0);
  const roundedMinutes = Math.ceil(date.getMinutes() / 5) * 5;
  date.setMinutes(roundedMinutes);
  if (date.getTime() <= min.getTime()) date.setMinutes(date.getMinutes() + 5);
  return date;
}

function sameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function triggerLabel(value: string) {
  const date = fromLocalValue(value);
  if (!date) return 'Elige fecha y hora';
  const day = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
  return `${day} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReminderDateTimePicker({
  value,
  onChange,
  min = new Date(),
}: ReminderDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => fromLocalValue(value) ?? suggestedDate(min));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = fromLocalValue(value);
    if (next) setDraft(next);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [isOpen]);

  const minuteOptions = useMemo(
    () => [...new Set([...Array.from({ length: 12 }, (_, index) => index * 5), draft.getMinutes()])]
      .sort((first, second) => first - second),
    [draft],
  );
  const isValid = draft.getTime() >= min.getTime();

  const open = () => {
    setDraft(fromLocalValue(value) ?? suggestedDate(min));
    setIsOpen((current) => !current);
  };

  const selectDay = (date: Date | undefined) => {
    if (!date) return;
    const next = new Date(date);
    next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
    if (sameDay(next, min) && next.getTime() < min.getTime()) {
      const suggested = suggestedDate(min);
      next.setHours(suggested.getHours(), suggested.getMinutes(), 0, 0);
    }
    setDraft(next);
  };

  const setTimePart = (part: 'hours' | 'minutes', nextValue: number) => {
    setDraft((current) => {
      const next = new Date(current);
      if (part === 'hours') next.setHours(nextValue);
      else next.setMinutes(nextValue);
      return next;
    });
  };

  return (
    <div className="date-time-picker" ref={rootRef}>
      <button
        className={value ? 'date-time-trigger has-value' : 'date-time-trigger'}
        type="button"
        aria-label="Fecha y hora"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={open}>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 3v3m10-3v3M4.5 9.5h15M6.5 5h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </svg>
        <span>{triggerLabel(value)}</span>
        <svg className="date-time-chevron" aria-hidden="true" viewBox="0 0 24 24">
          <path d="m8 10 4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <div className="date-time-popover" role="dialog" aria-label="Elige la fecha y hora">
          <DayPicker
            mode="single"
            locale={es}
            selected={draft}
            onSelect={selectDay}
            disabled={{ before: startOfDay(min) }}
            defaultMonth={draft}
            showOutsideDays
          />

          <div className="time-picker-row">
            <span>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Hora
            </span>
            <div className="time-selects">
              <select
                aria-label="Hora"
                value={draft.getHours()}
                onChange={(event) => setTimePart('hours', Number(event.target.value))}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <option value={hour} key={hour}>{pad(hour)}</option>
                ))}
              </select>
              <b>:</b>
              <select
                aria-label="Minutos"
                value={draft.getMinutes()}
                onChange={(event) => setTimePart('minutes', Number(event.target.value))}>
                {minuteOptions.map((minute) => (
                  <option value={minute} key={minute}>{pad(minute)}</option>
                ))}
              </select>
            </div>
          </div>

          {!isValid && <p className="date-time-error">Elige una hora posterior a la actual.</p>}

          <div className="date-time-actions">
            <button
              className="date-time-clear"
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}>
              Sin fecha
            </button>
            <button
              className="date-time-apply"
              type="button"
              disabled={!isValid}
              onClick={() => {
                onChange(toLocalValue(draft));
                setIsOpen(false);
              }}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
