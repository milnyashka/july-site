export const USERNAME_MIN = 6;
export const USERNAME_MAX = 20;
export const USERNAME_REGEX = /^[a-zA-Z]{6,20}$/;

export function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (!USERNAME_REGEX.test(trimmed)) {
    return 'invalid_format';
  }
  return null;
}

export function publicDisplayName(username: string | null | undefined): string {
  if (username?.trim()) {
    return username.trim();
  }
  return 'User';
}