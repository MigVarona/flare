'use client';

import { CSSProperties, useEffect, useRef, useState } from 'react';

type TourStep = {
  selector: string;
  eyebrow: string;
  title: string;
  description: string;
  glyph: string;
};

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const steps: TourStep[] = [
  {
    selector: '[data-onboarding="spaces"]',
    eyebrow: 'TUS ESPACIOS',
    title: 'Muévete entre tus grupos',
    description:
      'Aquí puedes cambiar de espacio, crear uno nuevo o entrar en otro mediante una llave.',
    glyph: '◉',
  },
  {
    selector: '[data-onboarding="reminders"]',
    eyebrow: 'AVISOS',
    title: 'Que nada se quede atrás',
    description:
      'Crea recordatorios para ti o para otras personas y consulta qué es lo siguiente.',
    glyph: '!',
  },
  {
    selector: '[data-onboarding="messages"]',
    eyebrow: 'CONVERSACIÓN',
    title: 'Todo el grupo al día',
    description:
      'Los últimos mensajes aparecen aquí. Entra para conversar, enviar fotos o compartir GIFs.',
    glyph: '≡',
  },
  {
    selector: '[data-onboarding="files"]',
    eyebrow: 'ARCHIVOS',
    title: 'Lo compartido, siempre a mano',
    description:
      'Encuentra las fotos y documentos recientes o abre el archivo completo del espacio.',
    glyph: '□',
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function WebOnboardingTour({ onFinish }: { onFinish: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(step.selector);
    if (!target) {
      setHighlight(null);
      return undefined;
    }

    const updateHighlight = () => {
      const rect = target.getBoundingClientRect();
      const gutter = window.innerWidth <= 640 ? 6 : 10;
      const top = Math.max(8, rect.top - gutter);
      const left = Math.max(8, rect.left - gutter);
      setHighlight({
        top,
        left,
        width: Math.min(window.innerWidth - left - 8, rect.width + gutter * 2),
        height: Math.min(window.innerHeight - top - 8, rect.height + gutter * 2),
      });
    };

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateHighlight();
    const settleTimer = window.setTimeout(updateHighlight, 380);
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, { capture: true, passive: true });
    cardRef.current?.focus();

    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, { capture: true });
    };
  }, [step]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFinish();
      if (event.key === 'ArrowRight') {
        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      }
      if (event.key === 'ArrowLeft') {
        setStepIndex((current) => Math.max(current - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFinish]);

  const cardWidth = typeof window === 'undefined' ? 360 : Math.min(360, window.innerWidth - 32);
  const estimatedCardHeight = 260;
  const cardStyle: CSSProperties = highlight
    ? {
        width: cardWidth,
        left: clamp(highlight.left, 16, window.innerWidth - cardWidth - 16),
        top:
          highlight.top + highlight.height + 18 + estimatedCardHeight < window.innerHeight
            ? highlight.top + highlight.height + 18
            : Math.max(16, highlight.top - estimatedCardHeight - 18),
      }
    : { width: cardWidth, left: 16, top: 16 };

  const finishStep = () => {
    if (stepIndex === steps.length - 1) {
      onFinish();
      return;
    }
    setStepIndex((current) => current + 1);
  };

  return (
    <div className="onboarding-tour" role="presentation">
      {highlight && (
        <div
          className="onboarding-spotlight"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
          aria-hidden="true"
        />
      )}
      <section
        className="onboarding-popover"
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        tabIndex={-1}
        ref={cardRef}>
        <header className="onboarding-popover-header">
          <span className="onboarding-glyph" aria-hidden="true">{step.glyph}</span>
          <span className="onboarding-progress">{stepIndex + 1} / {steps.length}</span>
        </header>
        <p className="eyebrow">{step.eyebrow}</p>
        <h2 id="onboarding-title">{step.title}</h2>
        <p id="onboarding-description">{step.description}</p>
        <div className="onboarding-dots" aria-hidden="true">
          {steps.map((item, index) => (
            <i className={index === stepIndex ? 'active' : ''} key={item.selector} />
          ))}
        </div>
        <footer className="onboarding-actions">
          <button className="onboarding-skip" type="button" onClick={onFinish}>Omitir</button>
          <span>
            {stepIndex > 0 && (
              <button type="button" onClick={() => setStepIndex((current) => current - 1)}>
                Atrás
              </button>
            )}
            <button className="primary-button" type="button" onClick={finishStep}>
              {stepIndex === steps.length - 1 ? 'Empezar' : 'Siguiente'}
              <span aria-hidden="true">→</span>
            </button>
          </span>
        </footer>
      </section>
    </div>
  );
}
