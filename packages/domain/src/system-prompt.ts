export function assembleSystemPrompts(input: {
  platform?: string | null;
  org?: string | null;
  project?: string | null;
  userAbout?: string | null;
  userPreferred?: string | null;
}): string[] {
  const parts: string[] = [];
  const push = (s: string | null | undefined) => {
    const t = s?.trim();
    if (t) parts.push(t);
  };
  push(input.platform);
  push(input.org);
  push(input.project);
  if (input.userAbout?.trim() || input.userPreferred?.trim()) {
    const bits: string[] = [];
    if (input.userAbout?.trim()) bits.push(`About the user: ${input.userAbout.trim()}`);
    if (input.userPreferred?.trim())
      bits.push(`Preferred response style: ${input.userPreferred.trim()}`);
    parts.push(bits.join("\n"));
  }
  return parts;
}
