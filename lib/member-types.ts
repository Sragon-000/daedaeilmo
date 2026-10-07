export const avatars = { sprout: '🌱', star: '⭐', fox: '🦊', cat: '🐱', bear: '🐻', penguin: '🐧' } as const;
export type Avatar = keyof typeof avatars;
export type Member = { id: string; school: string; name: string; nickname: string; avatar: Avatar; photoUrl?: string | null; needsSetup: boolean };
export type DisplayMode = 'name' | 'nickname';
export function validProfile(value: unknown): value is { name: string; nickname: string; avatar: Avatar } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return [v.name, v.nickname].every(x => typeof x === 'string' && x.trim().length >= 2 && x.trim().length <= 24 && !Array.from(x).some(c => c.charCodeAt(0) < 32))
    && typeof v.avatar === 'string' && Object.hasOwn(avatars, v.avatar);
}
