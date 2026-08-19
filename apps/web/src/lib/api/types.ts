export type DeletionSummary = {
  folderCount: number;
  fileCount: number;
  totalBytes: string;
};

export type DeletionSummaryResponse = {
  data: DeletionSummary;
};
