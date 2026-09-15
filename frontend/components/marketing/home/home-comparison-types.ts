export type HomeComparisonModel = {
  slug: string;
  name: string;
  logo: string;
  overall: number | null;
  criteriaCount: number;
  scores: (number | null)[];
};
export type HomeComparisonData = { left: HomeComparisonModel; opponents: HomeComparisonModel[] };
