export interface Defendant {
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
  user_id?: string;
  deleted_at?: string | null;
}

export type DefendantFormData = Omit<Defendant, 'id'>;

export interface DashboardStats {
  total: number;
  expiredReviews: number;
  longImprisonment: number;
  stalledCases: number;
}

import { CIVIL_CATEGORIES } from './constants';

// Civil Module Types
export type CivilCategory = typeof CIVIL_CATEGORIES[number];

export interface CivilCase {
  id: string;
  name: string;
  caseNumber: string;
  category: CivilCategory;
  isDelegated?: boolean;
  expeditionStatus?: 'pending' | 'dispatched';
  entryDate: string;
  lastMovementDate?: string;
  lastReevaluationDate?: string;
  deadlineDate?: string;
  obs?: string;
  user_id: string;
  deletedAt?: string | null;
}

export interface AdministrativeDocument {
  id: string;
  number: string;
  subject: string;
  date: string;
  issuer: 'Secretaria' | 'Gabinete';
  documentType?: string; // New field
  filePath?: string; // Path in Storage Bucket
  deletedAt?: string | null; // Soft Delete
  user_id: string;
}

export interface RogatoryLetter {
  id: string;
  caseNumber: string;
  direction?: 'incoming' | 'outgoing';
  defendantName: string; // Or "Parties" for Civil
  originCourt: string;
  type: 'civil' | 'criminal';
  receivedDate: string;
  deadlineDate?: string;
  status: 'pending' | 'completed' | 'returned';
  obs?: string;
  purpose?: string; // Finalidade (Intimação, Oitiva, etc)
  hasHearing?: boolean;
  hearingDate?: string;
  isPrisoner?: boolean;
  user_id: string;
  deletedAt?: string | null;
}

export interface SeiRequest {
  id: string;
  processNumber: string;
  subject: string;
  creationDate: string;
  lastMovementDate: string;
  currentSector: string;
  responsibleServer: string;
  status: string;
  user_id: string;
  deletedAt?: string | null;
}

export type CivilCaseFormData = Omit<CivilCase, 'id' | 'user_id'>;