import type { ItemAuditEntry } from "@/lib/itemAudit";
import type { NormalizeRepairStep } from "@/lib/itemNormalize";
import type { QueuedOperation } from "@/lib/operationQueue";

export type ItemCondition = "Excellent" | "Good" | "Fair" | "Poor";

export type Item = {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  location: string;
  repairLocation: string;
  width: number;
  height: number;
  depth: number;
  repairs: NormalizeRepairStep[];
  photos: string[];
  condition: ItemCondition;
  damageDescription: string;
  notes: string;
  dateAdded: string;
  brand: string;
  year: number;
  material: string;
  sold: boolean;
  soldAt?: string | null;
  soldBy?: string | null;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
  revision: number;
  auditTrail: ItemAuditEntry[];
  stockCount: number;
  stockLimit: number;
  stockUnit: string;
  stockHistory: Array<{ date: string; count: number }>;
};

export type AppSettings = {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyVAT: string;
  invoiceLogoUrl: string;
  invoiceBankAccount: string;
  invoiceIban: string;
  invoiceBic: string;
  invoicePaymentTerms: string;
  invoiceFooterNote: string;
  defaultInvoiceEmail: string;
  confirmBeforeDelete: boolean;
  autoOpenActivityLog: boolean;
  invoiceTemplate: string;
};

export type ServerStore = {
  schemaVersion: number;
  items: Item[];
  settings: AppSettings | null;
  queue: QueuedOperation[];
  updatedAt: string;
};
