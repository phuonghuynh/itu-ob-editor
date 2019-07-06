import { Translatable } from 'renderer/app/localizer';


export type ITURecCode = string;
export type ITURecVersion = string;

export interface Recommendation {
  body: string,
  code: ITURecCode,
  version: ITURecVersion,
}

export interface ITURecommendation {
  id: ITURecCode,
  version: ITURecVersion,
  title: Translatable,
}
