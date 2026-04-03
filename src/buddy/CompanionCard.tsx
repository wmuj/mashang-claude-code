import React from 'react'
import { Box, Text } from '../ink.js'
import { useInput } from '../ink.js'
import { renderSprite } from './sprites.js'
import { RARITY_COLORS, RARITY_STARS, STAT_NAMES, type Companion } from './types.js'

const CARD_WIDTH = 40
const CARD_PADDING_X = 2

export function CompanionCard({
  companion,
  lastReaction,
  onDone,
}: {
  companion: Companion
  lastReaction?: string
  onDone?: (result?: string, options?: { display?: string }) => void
}) {
  const color = RARITY_COLORS[companion.rarity]
  const stars = RARITY_STARS[companion.rarity]
  const sprite = renderSprite(companion, 0)

  useInput(
    () => {
      onDone?.(undefined, { display: 'skip' })
    },
    { isActive: onDone !== undefined },
  )

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={CARD_PADDING_X}
      paddingY={1}
      width={CARD_WIDTH}
      flexShrink={0}
    >
      <Box justifyContent="space-between">
        <Text bold color={color}>
          {stars} {companion.rarity.toUpperCase()}
        </Text>
        <Text color={color}>{companion.species.toUpperCase()}</Text>
      </Box>

      {companion.shiny && (
        <Text color="warning" bold>
          ✨ SHINY ✨
        </Text>
      )}

      <Box flexDirection="column" marginY={1}>
        {sprite.map((line, i) => (
          <Text key={i} color={color}>
            {line}
          </Text>
        ))}
      </Box>

      <Text bold>{companion.name}</Text>

      <Box marginY={1}>
        <Text dimColor italic>
          "{companion.personality}"
        </Text>
      </Box>

      <Box flexDirection="column">
        {STAT_NAMES.map(name => {
          const value = companion.stats[name] ?? 0
          const clamped = Math.max(0, Math.min(100, value))
          const filled = Math.round(clamped / 10)
          const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
          return (
            <Text key={name}>
              {name.padEnd(10)} {bar} {String(value).padStart(3)}
            </Text>
          )
        })}
      </Box>

      {lastReaction && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>last said</Text>
          <Box borderStyle="round" borderColor="inactive" paddingX={1}>
            <Text dimColor italic>
              {lastReaction}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
