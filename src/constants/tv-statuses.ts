export interface TvStatusOption {
  value: number;
  key: string;
}

export const TV_STATUSES: TvStatusOption[] = [
  { value: 0, key: "tvStatusReturning" },
  { value: 1, key: "tvStatusPlanned" },
  { value: 2, key: "tvStatusInProduction" },
  { value: 3, key: "tvStatusEnded" },
  { value: 4, key: "tvStatusCancelled" },
  { value: 5, key: "tvStatusPilot" },
];
