export enum PayRateType {
  Hourly = 0,
  Custom,
}

export enum DocumentType {
  ConsultingContract = 0,
  EquityPlanContract,
  ShareCertificate,
  TaxDocument,
  ExerciseNotice,
}

export enum DocumentTemplateType {
  ConsultingContract = 0,
  ExerciseNotice,
  LetterOfTransmittal,
  StockOptionAgreement,
}

export enum BusinessType {
  LLC = 0,
  CCorporation,
  SCorporation,
  Partnership,
}

export enum TaxClassification {
  CCorporation = 0,
  SCorporation,
  Partnership,
}

export enum SignInMethod {
  Email = "email",
  Google = "google",
}

export const invoiceStatuses = [
  "received",
  "approved",
  "processing",
  "payment_pending",
  "paid",
  "rejected",
  "failed",
] as const;

export const optionGrantTypes = ["iso", "nso"] as const;
export const optionGrantVestingTriggers = ["scheduled", "invoice_paid"] as const;
export const optionGrantIssueDateRelationships = [
  "employee",
  "consultant",
  "investor",
  "founder",
  "officer",
  "executive",
  "board_member",
] as const;
