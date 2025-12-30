export interface Defendant {
  id: string;
  name: string; // Réu
  caseNumber: string; // Processo
  penalType: string; // Tipo penal
  arrestDate: string; // Data da última prisão (YYYY-MM-DD)
  lastReviewDate: string; // Data da última revisão (YYYY-MM-DD)
  movementType: string; // Tipo de Movimentação
  lastMovementDate: string; // Data última movimentação (YYYY-MM-DD)
  deadline: number; // Prazo (in days)
  obs: string; // OBS
  rji: string; // RJI
  bnmp: string; // BNMP
  infopen: string; // INFOPEN
  prison: string; // Presídio
  user_id?: string; // ID do usuário que criou (Supabase)
}

export type DefendantFormData = Omit<Defendant, 'id'>;

export interface DashboardStats {
  total: number;
  expiredReviews: number;
  longImprisonment: number;
  stalledCases: number;
}