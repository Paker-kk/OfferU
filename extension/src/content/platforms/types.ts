import type { JobSource } from "../../types.js";

export interface PlatformConfig {
  source: JobSource;
  hostPattern: RegExp;
  listCard: string;
  listActionTargets: string[];
  listTitle: string[];
  listCompany: string[];
  listSalary: string[];
  listLocation: string[];
  listLink: string[];
  listTags: string[];
  listCompanyTags: string[];
  detailTitle: string[];
  detailCompany: string[];
  detailSalary: string[];
  detailLocation: string[];
  detailDescription: string[];
  detailApplyLink: string[];
  detailPostedAt: string[];
  detailTags: string[];
  detailCompanyTags: string[];
  detailPathHint?: RegExp;
}
