'use client';

import { Fragment } from 'react';

const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
const trailingPunctuation = /[.,!?;:'")\]}]+$/;

export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {text.split(urlPattern).map((segment, index) => {
        if (index % 2 === 0) return <Fragment key={index}>{segment}</Fragment>;
        const trailing = segment.match(trailingPunctuation)?.[0] ?? '';
        const url = trailing ? segment.slice(0, -trailing.length) : segment;
        const href = url.startsWith('http') ? url : `https://${url}`;
        return (
          <Fragment key={index}>
            <a href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
              {url}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </>
  );
}
