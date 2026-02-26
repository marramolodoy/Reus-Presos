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
  unit_id?: string;
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
  isConcluded?: boolean;
  concludedAt?: string | null;
  responsibleServer?: string;
  signatureServer?: boolean;
  signatureMagistrate?: boolean;
  subaccountId?: string;
  user_id: string;
  unit_id?: string;
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
  unit_id?: string;
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
  unit_id?: string;
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
  unit_id?: string;
  deletedAt?: string | null;
}

export type CivilCaseFormData = Omit<CivilCase, 'id' | 'user_id'>;

export interface LawyerRequest {
  id: string;
  name: string; // Nome do Advogado / Parte
  caseNumber: string; // Processo (Opcional)
  contactMethod: 'WhatsApp' | 'Email' | 'Telefone' | 'Presencial' | 'Balcão Virtual' | 'Outros';
  matter: 'Cível' | 'Criminal' | 'Outros';
  destination: 'Gabinete' | 'Secretaria';
  requestDate: string;
  isConcluded: boolean;
  concludedAt?: string | null;
  obs?: string;
  user_id: string;
  unit_id?: string;
  deletedAt?: string | null;
}

export type LawyerRequestFormData = Omit<LawyerRequest, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deletedAt'>;

export interface CriticalIssue {
  id: string;
  processNumber: string;
  defendantName?: string;
  lastMovementDate: string;
  reason: string;
  responsibleServer: string;
  status: 'pending' | 'resolved';
  user_id: string;
  unit_id?: string;
  deletedAt?: string | null;
}

export type CriticalIssueFormData = Omit<CriticalIssue, 'id' | 'user_id' | 'status' | 'deletedAt'>;

export interface PendingSchedule {
  id: string;
  processNumber: string; // process_number
  lastMovementDate?: string; // last_movement_date (Optional)
  scheduledDate?: string; // scheduled_date (New: Data da Audiência/Perícia)
  schedulingStatus?: 'scheduled' | 'to_be_scheduled'; // scheduling_status (New: "Audiência já designada" vs "Ainda a designar")
  subject: string;
  obs: string;
  type: 'hearing' | 'expertise';
  hearingType?: 'Conciliação' | 'Preliminar' | 'AIJ' | 'Continuação'; // hearing_type
  competence: 'Juizado' | 'Cível' | 'Criminal' | 'Delegada';
  expertiseType?: string; // expertise_type
  status: 'pending' | 'resolved'; // Status "Geral" (Ativo/Arquivado)
  completionStatus?: 'pending' | 'partial' | 'completed'; // Status do Cumprimento (Cor)
  tags?: string[]; // tags (List of tags like 'Réu Preso', 'Menor', etc.)
  user_id: string;
  unit_id?: string;
  deletedAt?: string | null; // deleted_at
}

export type PendingScheduleFormData = Omit<PendingSchedule, 'id' | 'user_id' | 'status' | 'deletedAt'>;

export interface PenhoraOrder {
  id: string;
  name: string;
  caseNumber: string;
  type: 'Sisbajud' | 'Renajud' | 'Infojud' | 'Siel' | 'Serasajud' | 'CNIB' | 'SNIPER';
  value?: number;
  lastUpdateDate?: string;
  status: string; // 'Aguardando Protocolo' | 'Aguardando Resposta' | other
  isTeimosinha?: boolean;
  protocolDate?: string;
  deadlineDate?: string;
  restrictionType?: string; // 'Transferência' | 'Licenciamento' | 'Circulação'
  obs?: string;
  user_id: string;
  unit_id?: string;
  deletedAt?: string | null;
}

export type PenhoraOrderFormData = Omit<PenhoraOrder, 'id' | 'user_id' | 'deletedAt'>;

export interface UserProfile {
  user_id: string;
  name: string;
  department?: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
  isConcluded?: boolean;
  concludedAt?: string | null;
  seizureDate?: string | null;
  hasCourtCase?: boolean;
}

export interface SeizedAsset {
  id: string;
  processNumber?: string;
  partyName: string;
  possibleOwner?: string;
  description: string;
  location: string;
  destinationStatus: string;
  isConcluded?: boolean;
  concludedAt?: string | null;
  seizureDate?: string;
  hasCourtCase?: boolean;
  user_id: string;
  unit_id?: string;
  deletedAt?: string | null;
}

export type SeizedAssetFormData = Omit<SeizedAsset, 'id' | 'user_id' | 'deletedAt'>;

export interface ProductivityLog {
  id: string;
  date: string;
  processNumbers: string;
  activities: string;
  user_id: string;
  unit_id?: string;
  created_at: string;
  deleted_at?: string | null;
}

export type ProductivityLogFormData = Omit<ProductivityLog, 'id' | 'user_id' | 'created_at' | 'deleted_at'>;