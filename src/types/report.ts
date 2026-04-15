export interface Report {
  id: string;
  description: string;
  denunciation_id: string;
  user_id: string;
  type: number;
  createdAt: string;
}

export interface CreateReportDTO {
  description: string;
  denunciation_id: string;
  user_id: string;
  type: number;
}