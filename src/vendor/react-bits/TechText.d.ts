import type { CSSProperties, ReactElement } from 'react'

/**
 * Types for the vendored `TechText.jsx`. Ours, not React Bits' — the registry
 * ships the JS/CSS variant with no declarations, and this lets the app's
 * TypeScript import it without enabling `allowJs` project-wide.
 *
 * Every prop is optional and defaulted by the component itself. Only the ones
 * the splash sets are documented; the rest are listed so passing them stays a
 * type error away from a typo, and so the defaults are discoverable without
 * opening the vendored source.
 */
export interface TechTextProps {
  text?: string
  fontFamily?: string
  fontWeight?: number
  fontSize?: number
  letterSpacing?: number
  color?: string
  accentColor?: string
  reach?: number
  softness?: number
  dashLength?: number
  dashGap?: number
  strokeWidth?: number
  lineStyle?: 'dashed' | 'solid'
  reveal?: 'letter' | 'word' | 'none'
  specks?: number
  selection?: boolean
  labels?: boolean
  draggable?: boolean
  sweep?: boolean
  speed?: number
  className?: string
  style?: CSSProperties
}

declare const TechText: (props: TechTextProps) => ReactElement
export default TechText
