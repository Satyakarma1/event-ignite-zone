export const MAX_TEAM_SIZE = 10;

export function teamSizeRangeError(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min == null && max == null) return null;
  if (min == null || max == null) return "Set both minimum and maximum team size.";
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 1 ||
    max < 1 ||
    min > MAX_TEAM_SIZE ||
    max > MAX_TEAM_SIZE
  ) {
    return `Team size must be between 1 and ${MAX_TEAM_SIZE}.`;
  }
  return min > max ? "Minimum team size cannot exceed maximum team size." : null;
}

export function formatTeamSizeRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min === max) return `Teams: ${min} members`;
  if (min != null && max != null) return `Teams: ${min}–${max} members`;
  if (min != null) return `Teams: at least ${min} members`;
  return `Teams: up to ${max} members`;
}

export function teamSizeLimitError(
  teamSize: number,
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min != null && teamSize < min) {
    return `Teams for this hackathon must allow at least ${min} members.`;
  }
  if (max != null && teamSize > max) {
    return `Teams for this hackathon can have at most ${max} members.`;
  }
  return null;
}
