import type { CompanyPipelineStage, CompanyStatus } from '../common';

import type { SoftDeletableEntity, TenantScopedEntity } from './base';

export interface Company extends TenantScopedEntity, SoftDeletableEntity {
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  source?: string | null;
  country: string | null;
  status: CompanyStatus;
  pipelineStage: CompanyPipelineStage;
  /** Lost with the Do not contact button. */
  doNotContact: boolean;
  /** Temporary-worker invoicing: CIS the client deducts, VAT rate (percent; the API sends decimals as text) and reverse charge. */
  cisDeductionRate?: number | string;
  vatRate?: number | string;
  vatReverseCharge?: boolean;
  /** Free text about the company (where it operates, its services, …). */
  about: string | null;
  ownerId: string | null;
  /** What the Pipeline Companies pop-up keeps for the company. */
  pipelineRecord?: CompanyPipelineRecord;
}

export interface CompanyStageRecord {
  /** What was written while the company was in this stage. */
  notes: string;
  updatedAt: string | null;
  /** When the company (last) entered the stage. */
  enteredAt: string | null;
}

export interface CompanyPay {
  hourlyRate: number | null;
  hoursPerDay: number;
  daysPerMonth: number;
  feePercent: number | null;
  currency: string;
}

/** The fee agreed with the company when it was won. */
export interface CompanyWin {
  fee: number;
  currency: string;
  /** How the fee works: per hire, % of annual salary, monthly retainer… */
  terms: string;
  agreedAt: string;
}

export interface CompanyPipelineRecord {
  stages?: Partial<Record<CompanyPipelineStage, CompanyStageRecord>>;
  pay?: CompanyPay | null;
  win?: CompanyWin | null;
}
