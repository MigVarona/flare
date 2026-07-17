import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from './themed-text';

import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalHeader } from '@/components/ui/modal';
import { Colors, neonBorder, Radius, Spacing } from '@/constants/theme';
import { parseInline, parseMarkdownBlocks, type MarkdownBlock } from '@/lib/markdown';

const theme = Colors.dark;

/**
 * Renders one of the legal documents (Terms, Privacy) as a scrollable modal. Used from both
 * onboarding (where accepting is implicit in creating an account) and Settings (where it just
 * needs to be readable again afterward) — same document, same rendering, two entry points.
 */
export function LegalModal({
  isOpen,
  onClose,
  markdown,
}: {
  isOpen: boolean;
  onClose: () => void;
  markdown: string;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown]);
  const title = blocks.find((block) => block.type === 'h1')?.text ?? '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalBackdrop />
      <ModalContent style={{ height: windowHeight * 0.75 }}>
        <ModalHeader>
          <ThemedText type="headline">{title}</ThemedText>
        </ModalHeader>
        <ModalBody scrollEnabled style={styles.scrollBody}>
          <View style={styles.sections}>
            {blocks
              .filter((block) => block.type !== 'h1')
              .map((block, index) => (
                <LegalBlock key={index} block={block} />
              ))}
          </View>
        </ModalBody>
        <View style={styles.closeButtonWrapper}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
            <ThemedText type="smallBold">Cerrar</ThemedText>
          </Pressable>
        </View>
      </ModalContent>
    </Modal>
  );
}

function LegalBlock({ block }: { block: MarkdownBlock }) {
  if (block.type === 'hr') {
    return <View style={styles.rule} />;
  }
  if (block.type === 'h2') {
    return <ThemedText type="smallBold">{block.text}</ThemedText>;
  }
  if (block.type === 'h3' || block.type === 'h4') {
    return (
      <ThemedText type="smallBold" style={styles.subheading}>
        {block.text}
      </ThemedText>
    );
  }

  if (block.type === 'ul') {
    return (
      <View style={styles.list}>
        {block.items.map((item, index) => (
          <View key={index} style={styles.listItem}>
            <ThemedText type="small" themeColor="textSecondary">
              {'• '}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.listText}>
              <LegalInline text={item} />
            </ThemedText>
          </View>
        ))}
      </View>
    );
  }

  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
      <LegalInline text={block.text} />
    </ThemedText>
  );
}

function LegalInline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, index) => {
        if (token.type === 'bold') {
          return (
            <ThemedText key={index} type="small" style={styles.bold}>
              {token.text}
            </ThemedText>
          );
        }
        if (token.type === 'link') {
          return (
            <ThemedText
              key={index}
              type="small"
              style={styles.link}
              onPress={() => Linking.openURL(token.href)}>
              {token.text}
            </ThemedText>
          );
        }
        if (token.type === 'code') {
          return (
            <ThemedText key={index} type="small" style={styles.code}>
              {token.text}
            </ThemedText>
          );
        }
        return token.text;
      })}
    </>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    flex: 1,
  },
  sections: {
    gap: Spacing[16],
  },
  paragraph: {
    lineHeight: 22,
  },
  bold: {
    fontFamily: 'Outfit_600SemiBold',
  },
  code: {
    fontFamily: 'Outfit_600SemiBold',
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing[4],
  },
  link: {
    color: theme.accent,
    textDecorationLine: 'underline',
  },
  subheading: {
    color: theme.textSecondary,
  },
  rule: {
    height: 1,
    backgroundColor: theme.border,
  },
  list: {
    gap: Spacing[8],
  },
  listItem: {
    flexDirection: 'row',
  },
  listText: {
    flex: 1,
    lineHeight: 22,
  },
  closeButtonWrapper: {
    marginTop: Spacing[16],
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: Spacing[16],
    borderRadius: Radius.pill,
    ...neonBorder(theme.border, 'FF'),
  },
});
