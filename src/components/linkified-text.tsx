import { Linking, Text } from 'react-native';

import { ThemedText, type ThemedTextProps } from './themed-text';

import { Colors } from '@/constants/theme';

const theme = Colors.dark;

/** Matches a URL up to the next whitespace — greedy on purpose, trimmed below. */
const UrlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
/** Punctuation that ends a sentence more often than it ends a URL: "mira esto: X.com." should
 * link "X.com", not "X.com.". */
const TrailingPunctuation = /[.,!?;:'")\]}]+$/;

/**
 * A note can carry a link, and until now that link just sat there as plain text — you'd
 * have to copy it out and paste it somewhere else to actually go anywhere. This renders the
 * same text but splits out anything URL-shaped into its own tappable span.
 *
 * `text.split(UrlPattern)` — one capturing group — hands back an array that alternates
 * plain text, match, plain text, match: odd indices are always the captured URLs.
 */
export function LinkifiedText({ text, ...rest }: { text: string } & ThemedTextProps) {
  const segments = text.split(UrlPattern);

  return (
    <ThemedText {...rest}>
      {segments.map((segment, index) => {
        if (index % 2 === 0) return segment;

        const trailing = segment.match(TrailingPunctuation)?.[0] ?? '';
        const url = trailing ? segment.slice(0, -trailing.length) : segment;

        return (
          // eslint-disable-next-line react/no-array-index-key
          <Text key={index}>
            <Text
              onPress={(event) => {
                // Without this, the tap also reaches whatever gesture opens the note
                // underneath — the same reason the pin button on this same bubble stops it.
                event.stopPropagation();
                const href = url.startsWith('http') ? url : `https://${url}`;
                Linking.openURL(href).catch(() => undefined);
              }}
              style={{ color: theme.accent, textDecorationLine: 'underline' }}>
              {url}
            </Text>
            {trailing}
          </Text>
        );
      })}
    </ThemedText>
  );
}
