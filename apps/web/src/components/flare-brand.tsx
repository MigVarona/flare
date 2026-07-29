'use client';

import { useId } from 'react';

type FlareBrandProps = {
  size?: number;
  wordmark?: boolean;
};

export function FlareBrand({ size = 40, wordmark = true }: FlareBrandProps) {
  const lensId = `flare-lens-${useId().replaceAll(':', '')}`;
  const radius = size * 0.25;
  const offset = radius * 0.62;
  const width = 2 * (offset + radius);
  const height = 2 * radius;

  return (
    <span className="flare-lockup" style={{ gap: size * 0.08 }} aria-label="Flare">
      <svg
        className="flare-mark"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true">
        <circle cx={radius} cy={radius} r={radius} fill="#F72E79" />
        <circle cx={radius + 2 * offset} cy={radius} r={radius} fill="#17A9F5" />
        <g clipPath={`url(#${lensId})`}>
          <circle cx={radius + 2 * offset} cy={radius} r={radius} fill="#F19AF5" />
        </g>
        <defs>
          <clipPath id={lensId}>
            <circle cx={radius} cy={radius} r={radius} />
          </clipPath>
        </defs>
      </svg>
      {wordmark && (
        <span
          className="flare-wordmark"
          style={{ fontSize: size * 0.66, lineHeight: `${size * 0.66 * 1.08}px` }}>
          flare
        </span>
      )}
    </span>
  );
}
