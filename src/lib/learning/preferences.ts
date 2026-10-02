export const STUDY_LANGUAGES = ["English", "Spanish", "French", "Hindi", "Arabic"] as const;
export type StudyLanguage = (typeof STUDY_LANGUAGES)[number];

export function getStudyLanguagePreference(): StudyLanguage | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const value = localStorage.getItem("study-language");
  return STUDY_LANGUAGES.find((language) => language === value);
}

export function studyLanguageInstruction(language?: StudyLanguage): string {
  return language
    ? `Write student-facing content in ${language}. Keep required JSON keys and schema unchanged.`
    : "";
}
