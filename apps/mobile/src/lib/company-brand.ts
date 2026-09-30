type CompanyBrandTheme = {
  accentSoft: string;
  accentStrong: string;
  success: string;
  successSoft: string;
  workflowBacklogSoft: string;
  workflowBacklogStrong: string;
  workflowUnstartedSoft: string;
  workflowUnstartedStrong: string;
};

/** Gives each Company a stable, theme-safe mark color from the app palette. */
export function companyMarkColors(seed: string, theme: CompanyBrandTheme) {
  const tones = [
    { background: theme.successSoft, foreground: theme.success },
    { background: theme.workflowUnstartedSoft, foreground: theme.workflowUnstartedStrong },
    { background: theme.workflowBacklogSoft, foreground: theme.workflowBacklogStrong },
    { background: theme.accentSoft, foreground: theme.accentStrong },
  ];
  const toneIndex = [...seed].reduce((value, character) => value + character.charCodeAt(0), 0) % tones.length;
  return tones[toneIndex]!;
}
