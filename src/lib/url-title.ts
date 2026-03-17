export const isValidHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const getDomainFromUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.hostname || null;
  } catch {
    return null;
  }
};
