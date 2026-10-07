/**
 * Motion language: calm and exact. Things fade in and settle a few pixels
 * into place on a long ease-out. No overshoot, no bounce, nothing that
 * draws attention to itself.
 */
import { Platform } from 'react-native';
import { Easing, Keyframe, LinearTransition } from 'react-native-reanimated';

/**
 * In browsers, entering animations start late and leave content invisible for
 * a beat, so the web version just shows things straight away.
 */
const ANIMATE = Platform.OS !== 'web';

/** Fast start, long gentle landing (close to the iOS default curve). */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
/** Symmetric, for loops that breathe in and out. */
export const EASE_IN_OUT = Easing.bezier(0.45, 0, 0.55, 1);

export const DURATION = { fast: 220, base: 420, slow: 600 } as const;

/** Fade in while rising a few pixels. `delay` staggers lists. */
export function rise(delay = 0, distance = 10, duration: number = DURATION.base) {
  if (!ANIMATE) return undefined;
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: distance }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
  })
    .duration(duration)
    .delay(delay);
}

/** Fade in from very slightly smaller — for a surface that arrives on its own. */
export function settle(delay = 0, duration: number = DURATION.slow) {
  if (!ANIMATE) return undefined;
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.97 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
  })
    .duration(duration)
    .delay(delay);
}

/** Horizontal glide for paging (onboarding). */
export function glide(direction: 1 | -1, distance = 28) {
  if (!ANIMATE) return undefined;
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateX: distance * direction }] },
    100: { opacity: 1, transform: [{ translateX: 0 }], easing: EASE_OUT },
  }).duration(DURATION.slow);
}

/** Fade out, quickly, so the next thing isn't kept waiting. */
export function fadeAway(duration: number = DURATION.fast) {
  if (!ANIMATE) return undefined;
  return new Keyframe({
    0: { opacity: 1 },
    100: { opacity: 0, easing: Easing.out(Easing.quad) },
  }).duration(duration);
}

/** Items reflow smoothly when a list changes. */
export const smoothLayout = ANIMATE ? LinearTransition.duration(DURATION.base).easing(EASE_OUT) : undefined;
