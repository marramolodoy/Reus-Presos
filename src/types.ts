id: string;
name: string; // Réu
caseNumber: string; // Processo
penalType: string; // Tipo penal
prisonType: 'Preventiva' | 'Temporária' | 'Provisória' | 'Definitiva' | 'Cível' | 'Domiciliar'; // Tipo de Prisão
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
hasHearing?: boolean; // Tem audiência designada?
hearingDate?: string; // Data da audiência
linkedDefendantIds?: string[]; // IDs de réus linkados
user_id ?: string; // ID do usuário que criou (Supabase)
}

export type DefendantFormData = Omit<Defendant, 'id'>;

export interface DashboardStats {
  total: number;
  expiredReviews: number;
  longImprisonment: number;
  stalledCases: number;
}