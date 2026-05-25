import type { ProfileData, ProfileSection } from "@/lib/hooks";
import { descriptionLinesToPlainText, splitBullets, textFromHtml } from "@/lib/resumeText";

export type ArchiveTab = "resume" | "application";

export interface ResumeBasicInfo {
  name: string;
  phone: string;
  email: string;
  currentCity: string;
  jobIntention: string;
  website: string;
  github: string;
}

export interface ResumeEducationItem {
  id: string;
  schoolName: string;
  educationLevel: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
  gpa: string;
  relatedCourses: string[];
  description: string;
}

export interface ResumeWorkItem {
  id: string;
  companyName: string;
  department: string;
  positionName: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeInternshipItem {
  id: string;
  companyName: string;
  positionName: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeProjectItem {
  id: string;
  projectName: string;
  projectRole: string;
  startDate: string;
  endDate: string;
  projectLink: string;
  description: string;
}

export interface ResumeSkillItem {
  id: string;
  skillName: string;
  proficiency: string;
  remark: string;
}

export interface ResumeCertificateItem {
  id: string;
  certificateName: string;
  scoreOrLevel: string;
  acquiredAt: string;
  issuer: string;
}

export interface ResumeAwardItem {
  id: string;
  awardName: string;
  issuer: string;
  awardedAt: string;
  description: string;
}

export interface ResumePersonalExperienceItem {
  id: string;
  experienceTitle: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeArchive {
  basicInfo: ResumeBasicInfo;
  personalSummary: string;
  education: ResumeEducationItem[];
  workExperiences: ResumeWorkItem[];
  internshipExperiences: ResumeInternshipItem[];
  projects: ResumeProjectItem[];
  skills: ResumeSkillItem[];
  certificates: ResumeCertificateItem[];
  awards: ResumeAwardItem[];
  personalExperiences: ResumePersonalExperienceItem[];
}

export interface ApplicationIdentityContact {
  chineseName: string;
  englishOrPinyinName: string;
  phone: string;
  email: string;
  gender: string;
  birthDate: string;
  nationalityOrRegion: string;
  idType: string;
  idNumber: string;
  currentCity: string;
  currentAddress: string;
  nativePlace: string;
  householdRegistration: string;
  ethnicity: string;
  politicalStatus: string;
  maritalStatus: string;
}

export interface ApplicationJobPreference {
  expectedPosition: string;
  expectedPositionCategory: string;
  expectedCities: string[];
  expectedSalary: string;
  employmentType: string;
  availableStartDate: string;
  currentJobSearchStatus: string;
  acceptAdjustment: string;
  acceptBusinessTravel: string;
  acceptAssignment: string;
  acceptShiftWork: string;
}

export interface ApplicationCampusFields {
  isFreshGraduate: string;
  graduationDate: string;
  studentOrigin: string;
  studentStatus: string;
  studentId: string;
  gpa: string;
  majorRank: string;
  transcriptRef: ArchiveAttachment | null;
  thesis: string;
  patent: string;
  researchExperiences: string[];
  internshipCertificateRef: ArchiveAttachment | null;
}

export interface ApplicationFamilyMemberItem {
  id: string;
  name: string;
  relation: string;
  company: string;
  position: string;
  contact: string;
}

export interface ApplicationRelationshipCompliance {
  familyMembers: ApplicationFamilyMemberItem[];
  hasRelativeInTargetCompany: string;
  relativeName: string;
  relativeRelation: string;
  relativeDepartment: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  backgroundCheckAuthorization: string;
  hasNonCompete: string;
  healthDeclaration: string;
}

export interface ApplicationSourceReferral {
  sourceChannel: string;
  referralCode: string;
  referralName: string;
  referralEmployeeId: string;
  referralContact: string;
  recommenderInfo: string;
  notes: string;
}

export interface ArchiveAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  fieldType: string;
}

export interface ApplicationAttachments {
  resumeZh: ArchiveAttachment | null;
  resumeEn: ArchiveAttachment | null;
  idPhoto: ArchiveAttachment | null;
  lifePhoto: ArchiveAttachment | null;
  transcript: ArchiveAttachment | null;
  graduationCertificate: ArchiveAttachment | null;
  degreeCertificate: ArchiveAttachment | null;
  chsiMaterials: ArchiveAttachment | null;
  internshipCertificate: ArchiveAttachment | null;
  professionalCertificates: ArchiveAttachment | null;
  otherAttachments: ArchiveAttachment[];
}

export interface ApplicationArchive {
  shared: ResumeArchive;
  identityContact: ApplicationIdentityContact;
  jobPreference: ApplicationJobPreference;
  campusFields: ApplicationCampusFields;
  relationshipCompliance: ApplicationRelationshipCompliance;
  sourceReferral: ApplicationSourceReferral;
  attachments: ApplicationAttachments;
}

export interface SyncSettings {
  autoSyncEnabled: boolean;
  overriddenFieldPaths: string[];
}

export interface PersonalArchive {
  schemaVersion: "personal.archive.v1";
  updatedAt: string;
  resumeArchive: ResumeArchive;
  applicationArchive: ApplicationArchive;
  syncSettings: SyncSettings;
}

export interface ArchiveCompletenessMetrics {
  resumeCompleteness: number;
  applicationCompleteness: number;
  missingFieldCount: number;
  syncableFieldCount: number;
  missingResumeSections: string[];
  missingResumeSectionKeys: string[];
  missingApplicationSections: string[];
  missingApplicationSectionKeys: string[];
}

export interface SyncResult {
  nextArchive: PersonalArchive;
  syncedPaths: string[];
  skippedOverriddenPaths: string[];
}

export const SHARED_ROOT_PATHS = [
  "basicInfo.name",
  "basicInfo.phone",
  "basicInfo.email",
  "basicInfo.currentCity",
  "basicInfo.jobIntention",
  "basicInfo.website",
  "basicInfo.github",
  "personalSummary",
  "education",
  "workExperiences",
  "internshipExperiences",
  "projects",
  "skills",
  "certificates",
  "awards",
  "personalExperiences",
] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item).trim()).filter(Boolean);
  }
  const text = asString(value).trim();
  if (!text) return [];
  return text
    .split(/[,，、；;\n|]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAttachmentValue(value: unknown, fieldType: string): ArchiveAttachment | null {
  if (!value) return null;
  if (typeof value === "string") {
    const fileName = value.trim();
    if (!fileName) return null;
    return {
      id: createId("att"),
      fileName,
      fileType: "",
      fileSize: 0,
      uploadedAt: nowIso(),
      fieldType,
    };
  }
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, any>;
  const fileName = asString(obj.fileName || obj.name || obj.filename);
  if (!fileName) return null;
  return {
    id: asString(obj.id) || createId("att"),
    fileName,
    fileType: asString(obj.fileType || obj.mimeType || obj.type),
    fileSize: Number(obj.fileSize || obj.size || 0) || 0,
    uploadedAt: asString(obj.uploadedAt || obj.createdAt) || nowIso(),
    fieldType: asString(obj.fieldType) || fieldType,
  };
}

function normalizeAttachmentList(value: unknown, fieldType: string): ArchiveAttachment[] {
  if (!Array.isArray(value)) {
    const single = normalizeAttachmentValue(value, fieldType);
    return single ? [single] : [];
  }
  return value
    .map((item) => normalizeAttachmentValue(item, fieldType))
    .filter((item): item is ArchiveAttachment => Boolean(item));
}

function hasAttachment(value: ArchiveAttachment | null | undefined): boolean {
  return Boolean(value && asString(value.fileName).trim());
}

function cloneArchive(archive: PersonalArchive): PersonalArchive {
  return JSON.parse(JSON.stringify(archive)) as PersonalArchive;
}

function normalizeDescription(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const lines = value.map((item) => asString(item).trim()).filter(Boolean);
    if (lines.length === 0) return "";
    if (lines.length === 1) return `<p>${lines[0]}</p>`;
    return `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`;
  }
  const text = asString(value).trim();
  return text ? `<p>${text}</p>` : "";
}

function createEmptyEducation(): ResumeEducationItem {
  return {
    id: createId("edu"),
    schoolName: "",
    educationLevel: "",
    degree: "",
    major: "",
    startDate: "",
    endDate: "",
    gpa: "",
    relatedCourses: [],
    description: "",
  };
}

function createEmptyWork(): ResumeWorkItem {
  return {
    id: createId("work"),
    companyName: "",
    department: "",
    positionName: "",
    startDate: "",
    endDate: "",
    description: "",
  };
}

function createEmptyInternship(): ResumeInternshipItem {
  return {
    id: createId("intern"),
    companyName: "",
    positionName: "",
    startDate: "",
    endDate: "",
    description: "",
  };
}

function createEmptyProject(): ResumeProjectItem {
  return {
    id: createId("proj"),
    projectName: "",
    projectRole: "",
    startDate: "",
    endDate: "",
    projectLink: "",
    description: "",
  };
}

function createEmptySkill(): ResumeSkillItem {
  return {
    id: createId("skill"),
    skillName: "",
    proficiency: "",
    remark: "",
  };
}

function createEmptyCertificate(): ResumeCertificateItem {
  return {
    id: createId("cert"),
    certificateName: "",
    scoreOrLevel: "",
    acquiredAt: "",
    issuer: "",
  };
}

function createEmptyAward(): ResumeAwardItem {
  return {
    id: createId("award"),
    awardName: "",
    issuer: "",
    awardedAt: "",
    description: "",
  };
}

function createEmptyPersonalExperience(): ResumePersonalExperienceItem {
  return {
    id: createId("personal"),
    experienceTitle: "",
    startDate: "",
    endDate: "",
    description: "",
  };
}

function createDefaultResumeArchive(): ResumeArchive {
  return {
    basicInfo: {
      name: "",
      phone: "",
      email: "",
      currentCity: "",
      jobIntention: "",
      website: "",
      github: "",
    },
    personalSummary: "",
    education: [],
    workExperiences: [],
    internshipExperiences: [],
    projects: [],
    skills: [],
    certificates: [],
    awards: [],
    personalExperiences: [],
  };
}

function createDefaultApplicationArchive(shared: ResumeArchive): ApplicationArchive {
  return {
    shared: JSON.parse(JSON.stringify(shared)) as ResumeArchive,
    identityContact: {
      chineseName: "",
      englishOrPinyinName: "",
      phone: "",
      email: "",
      gender: "",
      birthDate: "",
      nationalityOrRegion: "",
      idType: "",
      idNumber: "",
      currentCity: "",
      currentAddress: "",
      nativePlace: "",
      householdRegistration: "",
      ethnicity: "",
      politicalStatus: "",
      maritalStatus: "",
    },
    jobPreference: {
      expectedPosition: "",
      expectedPositionCategory: "",
      expectedCities: [],
      expectedSalary: "",
      employmentType: "",
      availableStartDate: "",
      currentJobSearchStatus: "",
      acceptAdjustment: "",
      acceptBusinessTravel: "",
      acceptAssignment: "",
      acceptShiftWork: "",
    },
    campusFields: {
      isFreshGraduate: "",
      graduationDate: "",
      studentOrigin: "",
      studentStatus: "",
      studentId: "",
      gpa: "",
      majorRank: "",
      transcriptRef: null,
      thesis: "",
      patent: "",
      researchExperiences: [],
      internshipCertificateRef: null,
    },
    relationshipCompliance: {
      familyMembers: [],
      hasRelativeInTargetCompany: "",
      relativeName: "",
      relativeRelation: "",
      relativeDepartment: "",
      emergencyContactName: "",
      emergencyContactRelation: "",
      emergencyContactPhone: "",
      backgroundCheckAuthorization: "",
      hasNonCompete: "",
      healthDeclaration: "",
    },
    sourceReferral: {
      sourceChannel: "",
      referralCode: "",
      referralName: "",
      referralEmployeeId: "",
      referralContact: "",
      recommenderInfo: "",
      notes: "",
    },
    attachments: {
      resumeZh: null,
      resumeEn: null,
      idPhoto: null,
      lifePhoto: null,
      transcript: null,
      graduationCertificate: null,
      degreeCertificate: null,
      chsiMaterials: null,
      internshipCertificate: null,
      professionalCertificates: null,
      otherAttachments: [],
    },
  };
}

export function createDefaultPersonalArchive(): PersonalArchive {
  const resumeArchive = createDefaultResumeArchive();
  return {
    schemaVersion: "personal.archive.v1",
    updatedAt: nowIso(),
    resumeArchive,
    applicationArchive: createDefaultApplicationArchive(resumeArchive),
    syncSettings: {
      autoSyncEnabled: true,
      overriddenFieldPaths: [],
    },
  };
}

function sectionText(section: ProfileSection): string {
  const content = section.content_json || {};
  if (typeof content.bullet === "string" && content.bullet.trim()) {
    return content.bullet.trim();
  }
  const normalized = typeof content.normalized === "object" && content.normalized ? content.normalized : {};
  const picks = [
    normalized.description,
    normalized.company,
    normalized.position,
    normalized.school,
    normalized.name,
    normalized.role,
  ]
    .map((item: unknown) => asString(item).trim())
    .filter(Boolean);
  if (picks.length > 0) return picks.join(" | ");
  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}

function buildFromLegacySections(sections: ProfileSection[]): Partial<ResumeArchive> {
  const resumeArchive: Partial<ResumeArchive> = {
    education: [],
    workExperiences: [],
    internshipExperiences: [],
    projects: [],
    skills: [],
    certificates: [],
    awards: [],
    personalExperiences: [],
  };

  for (const section of sections || []) {
    const normalized = (section.content_json?.normalized || {}) as Record<string, any>;
    const category = String(section.category_key || section.section_type || "").toLowerCase();
    const title = asString(section.title).trim();
    const label = asString(section.category_label).trim();
    const bucketHint = `${title} ${label}`.toLowerCase();

    if (category === "education") {
      resumeArchive.education?.push({
        id: createId("edu"),
        schoolName: asString(normalized.school || normalized.school_name || title),
        educationLevel: asString(normalized.degree),
        degree: asString(normalized.degree),
        major: asString(normalized.major),
        startDate: asString(normalized.start_date),
        endDate: asString(normalized.end_date),
        gpa: asString(normalized.gpa),
        relatedCourses: asStringList(normalized.related_courses),
        description: normalizeDescription(normalized.description || sectionText(section)),
      });
      continue;
    }

    if (category === "experience") {
      if (bucketHint.includes("实习")) {
        resumeArchive.internshipExperiences?.push({
          id: createId("intern"),
          companyName: asString(normalized.company || title),
          positionName: asString(normalized.position),
          startDate: asString(normalized.start_date),
          endDate: asString(normalized.end_date),
          description: normalizeDescription(normalized.description || sectionText(section)),
        });
      } else {
        resumeArchive.workExperiences?.push({
          id: createId("work"),
          companyName: asString(normalized.company || title),
          department: asString(normalized.department),
          positionName: asString(normalized.position),
          startDate: asString(normalized.start_date),
          endDate: asString(normalized.end_date),
          description: normalizeDescription(normalized.description || sectionText(section)),
        });
      }
      continue;
    }

    if (category === "project") {
      resumeArchive.projects?.push({
        id: createId("proj"),
        projectName: asString(normalized.name || title),
        projectRole: asString(normalized.role),
        startDate: asString(normalized.start_date),
        endDate: asString(normalized.end_date),
        projectLink: asString(normalized.url),
        description: normalizeDescription(normalized.description || sectionText(section)),
      });
      continue;
    }

    if (category === "skill") {
      const skillItems = asStringList(normalized.items);
      if (skillItems.length > 0) {
        for (const skillName of skillItems) {
          resumeArchive.skills?.push({
            id: createId("skill"),
            skillName,
            proficiency: "",
            remark: "",
          });
        }
      } else {
        resumeArchive.skills?.push({
          id: createId("skill"),
          skillName: asString(normalized.category || title || sectionText(section)),
          proficiency: "",
          remark: "",
        });
      }
      continue;
    }

    if (category === "certificate") {
      resumeArchive.certificates?.push({
        id: createId("cert"),
        certificateName: asString(normalized.name || title),
        scoreOrLevel: "",
        acquiredAt: asString(normalized.date),
        issuer: asString(normalized.issuer),
      });
      continue;
    }

    if (bucketHint.includes("award") || bucketHint.includes("奖")) {
      resumeArchive.awards?.push({
        id: createId("award"),
        awardName: title || "获奖经历",
        issuer: "",
        awardedAt: "",
        description: normalizeDescription(sectionText(section)),
      });
      continue;
    }

    resumeArchive.personalExperiences?.push({
      id: createId("personal"),
      experienceTitle: title || "个人经历",
      startDate: "",
      endDate: "",
      description: normalizeDescription(sectionText(section)),
    });
  }

  return resumeArchive;
}

function normalizeResumeArchiveCandidate(value: unknown): ResumeArchive {
  const defaults = createDefaultResumeArchive();
  const source = value && typeof value === "object" ? (value as Record<string, any>) : {};
  const basicInfoSource =
    source.basicInfo && typeof source.basicInfo === "object"
      ? (source.basicInfo as Record<string, any>)
      : {};

  return {
    basicInfo: {
      ...defaults.basicInfo,
      name: asString(basicInfoSource.name),
      phone: asString(basicInfoSource.phone),
      email: asString(basicInfoSource.email),
      currentCity: asString(basicInfoSource.currentCity),
      jobIntention: asString(basicInfoSource.jobIntention),
      website: asString(basicInfoSource.website),
      github: asString(basicInfoSource.github),
    },
    personalSummary: asString(source.personalSummary),
    education: Array.isArray(source.education)
      ? source.education.map((item) => {
          const { descriptions: _old, ...rest } = item || {};
          return {
            ...createEmptyEducation(),
            ...rest,
            id: asString((item as any)?.id) || createId("edu"),
            relatedCourses: asStringList((item as any)?.relatedCourses),
            description: normalizeDescription((item as any)?.description || _old),
          };
        })
      : [],
    workExperiences: Array.isArray(source.workExperiences)
      ? source.workExperiences.map((item) => {
          const { descriptions: _old, ...rest } = item || {};
          return {
            ...createEmptyWork(),
            ...rest,
            id: asString((item as any)?.id) || createId("work"),
            description: normalizeDescription((item as any)?.description || _old),
          };
        })
      : [],
    internshipExperiences: Array.isArray(source.internshipExperiences)
      ? source.internshipExperiences.map((item) => {
          const { descriptions: _old, ...rest } = item || {};
          return {
            ...createEmptyInternship(),
            ...rest,
            id: asString((item as any)?.id) || createId("intern"),
            description: normalizeDescription((item as any)?.description || _old),
          };
        })
      : [],
    projects: Array.isArray(source.projects)
      ? source.projects.map((item) => {
          const { descriptions: _old, ...rest } = item || {};
          return {
            ...createEmptyProject(),
            ...rest,
            id: asString((item as any)?.id) || createId("proj"),
            description: normalizeDescription((item as any)?.description || _old),
          };
        })
      : [],
    skills: Array.isArray(source.skills)
      ? source.skills.map((item) => ({
          ...createEmptySkill(),
          ...(item || {}),
          id: asString((item as any)?.id) || createId("skill"),
        }))
      : [],
    certificates: Array.isArray(source.certificates)
      ? source.certificates.map((item) => ({
          ...createEmptyCertificate(),
          ...(item || {}),
          id: asString((item as any)?.id) || createId("cert"),
        }))
      : [],
    awards: Array.isArray(source.awards)
      ? source.awards.map((item) => {
          const { descriptions: _old, ...rest } = item || {};
          return {
            ...createEmptyAward(),
            ...rest,
            id: asString((item as any)?.id) || createId("award"),
            description: normalizeDescription((item as any)?.description || _old),
          };
        })
      : [],
    personalExperiences: Array.isArray(source.personalExperiences)
      ? source.personalExperiences.map((item) => {
          const { descriptions: _old, ...rest } = item || {};
          return {
            ...createEmptyPersonalExperience(),
            ...rest,
            id: asString((item as any)?.id) || createId("personal"),
            description: normalizeDescription((item as any)?.description || _old),
          };
        })
      : [],
  };
}

function normalizeApplicationArchiveCandidate(value: unknown, fallbackShared: ResumeArchive): ApplicationArchive {
  const defaults = createDefaultApplicationArchive(fallbackShared);
  const source = value && typeof value === "object" ? (value as Record<string, any>) : {};

  const identityContact =
    source.identityContact && typeof source.identityContact === "object"
      ? (source.identityContact as Record<string, any>)
      : {};
  const jobPreference =
    source.jobPreference && typeof source.jobPreference === "object"
      ? (source.jobPreference as Record<string, any>)
      : {};
  const campusFields =
    source.campusFields && typeof source.campusFields === "object"
      ? (source.campusFields as Record<string, any>)
      : {};
  const relationshipCompliance =
    source.relationshipCompliance && typeof source.relationshipCompliance === "object"
      ? (source.relationshipCompliance as Record<string, any>)
      : {};
  const sourceReferral =
    source.sourceReferral && typeof source.sourceReferral === "object"
      ? (source.sourceReferral as Record<string, any>)
      : {};
  const attachments =
    source.attachments && typeof source.attachments === "object"
      ? (source.attachments as Record<string, any>)
      : {};

  const familyMembers = Array.isArray(relationshipCompliance.familyMembers)
    ? relationshipCompliance.familyMembers.map((item: any) => ({
        id: asString(item?.id) || createId("family"),
        name: asString(item?.name),
        relation: asString(item?.relation),
        company: asString(item?.company),
        position: asString(item?.position),
        contact: asString(item?.contact),
      }))
    : [];

  return {
    ...defaults,
    shared: normalizeResumeArchiveCandidate(source.shared || fallbackShared),
    identityContact: {
      ...defaults.identityContact,
      ...identityContact,
    },
    jobPreference: {
      ...defaults.jobPreference,
      ...jobPreference,
      expectedCities: asStringList(jobPreference.expectedCities),
    },
    campusFields: {
      ...defaults.campusFields,
      ...campusFields,
      researchExperiences: asStringList(campusFields.researchExperiences),
      transcriptRef: normalizeAttachmentValue(campusFields.transcriptRef, "campus.transcriptRef"),
      internshipCertificateRef: normalizeAttachmentValue(
        campusFields.internshipCertificateRef,
        "campus.internshipCertificateRef"
      ),
    },
    relationshipCompliance: {
      ...defaults.relationshipCompliance,
      ...relationshipCompliance,
      familyMembers,
    },
    sourceReferral: {
      ...defaults.sourceReferral,
      ...sourceReferral,
    },
    attachments: {
      ...defaults.attachments,
      resumeZh: normalizeAttachmentValue(attachments.resumeZh, "attachments.resumeZh"),
      resumeEn: normalizeAttachmentValue(attachments.resumeEn, "attachments.resumeEn"),
      idPhoto: normalizeAttachmentValue(attachments.idPhoto, "attachments.idPhoto"),
      lifePhoto: normalizeAttachmentValue(attachments.lifePhoto, "attachments.lifePhoto"),
      transcript: normalizeAttachmentValue(attachments.transcript, "attachments.transcript"),
      graduationCertificate: normalizeAttachmentValue(
        attachments.graduationCertificate,
        "attachments.graduationCertificate"
      ),
      degreeCertificate: normalizeAttachmentValue(attachments.degreeCertificate, "attachments.degreeCertificate"),
      chsiMaterials: normalizeAttachmentValue(attachments.chsiMaterials, "attachments.chsiMaterials"),
      internshipCertificate: normalizeAttachmentValue(
        attachments.internshipCertificate,
        "attachments.internshipCertificate"
      ),
      professionalCertificates: normalizeAttachmentValue(
        attachments.professionalCertificates,
        "attachments.professionalCertificates"
      ),
      otherAttachments: normalizeAttachmentList(attachments.otherAttachments, "attachments.otherAttachments"),
    },
  };
}

function normalizePersistedArchive(value: unknown): PersonalArchive {
  const defaults = createDefaultPersonalArchive();
  const source = value && typeof value === "object" ? (value as Record<string, any>) : {};

  const resumeArchive = normalizeResumeArchiveCandidate(source.resumeArchive);
  const applicationArchive = normalizeApplicationArchiveCandidate(source.applicationArchive, resumeArchive);
  const syncSettings =
    source.syncSettings && typeof source.syncSettings === "object"
      ? (source.syncSettings as Record<string, any>)
      : {};

  return {
    schemaVersion: "personal.archive.v1",
    updatedAt: asString(source.updatedAt) || nowIso(),
    resumeArchive,
    applicationArchive,
    syncSettings: {
      autoSyncEnabled:
        typeof syncSettings.autoSyncEnabled === "boolean"
          ? syncSettings.autoSyncEnabled
          : defaults.syncSettings.autoSyncEnabled,
      overriddenFieldPaths: Array.isArray(syncSettings.overriddenFieldPaths)
        ? uniquePaths(syncSettings.overriddenFieldPaths.map((item) => asString(item)))
        : [],
    },
  };
}

export function normalizePersonalArchiveFromProfile(profileData: ProfileData | null | undefined): PersonalArchive {
  const fallback = createDefaultPersonalArchive();
  if (!profileData) return fallback;

  const base = profileData.base_info_json && typeof profileData.base_info_json === "object"
    ? profileData.base_info_json
    : {};

  const existing = base.personal_archive;
  if (existing && typeof existing === "object" && existing.schemaVersion === "personal.archive.v1") {
    return normalizePersistedArchive(existing);
  }

  const resumeArchive = createDefaultResumeArchive();
  resumeArchive.basicInfo = {
    name: asString(base.name || profileData.name),
    phone: asString(base.phone),
    email: asString(base.email),
    currentCity: asString(base.current_city),
    jobIntention: asString(base.job_intention),
    website: asString(base.website),
    github: asString(base.github),
  };
  resumeArchive.personalSummary = asString(
    base.summary || base.personal_summary || base.personalIntro || base.personal_introduction
  );

  const fromSections = buildFromLegacySections(profileData.sections || []);
  resumeArchive.education = fromSections.education || [];
  resumeArchive.workExperiences = fromSections.workExperiences || [];
  resumeArchive.internshipExperiences = fromSections.internshipExperiences || [];
  resumeArchive.projects = fromSections.projects || [];
  resumeArchive.skills = fromSections.skills || [];
  resumeArchive.certificates = fromSections.certificates || [];
  resumeArchive.awards = fromSections.awards || [];
  resumeArchive.personalExperiences = fromSections.personalExperiences || [];

  return {
    schemaVersion: "personal.archive.v1",
    updatedAt: nowIso(),
    resumeArchive,
    applicationArchive: createDefaultApplicationArchive(resumeArchive),
    syncSettings: {
      autoSyncEnabled: true,
      overriddenFieldPaths: [],
    },
  };
}

function countNonEmpty(values: string[]): number {
  return values.map((item) => asString(item).trim()).filter(Boolean).length;
}

export function computeArchiveCompleteness(archive: PersonalArchive): ArchiveCompletenessMetrics {
  const resume = archive.resumeArchive;
  const app = archive.applicationArchive;

  let resumeFilled = 0;
  let resumeTotal = 0;
  const missingResumeSections: string[] = [];

  const missingResumeSectionKeys: string[] = [];
  const resumeChecks: Array<{ key: string; label: string; ok: boolean }> = [
    { key: "basicInfo", label: "基础信息", ok: !!resume.basicInfo.name.trim() },
    { key: "personalSummary", label: "个人简介", ok: !!resume.personalSummary.trim() },
    { key: "education", label: "教育经历", ok: resume.education.some((item) => !!item.schoolName.trim()) },
    { key: "workExperiences", label: "工作经历", ok: resume.workExperiences.some((item) => !!item.companyName.trim()) },
    { key: "internshipExperiences", label: "实习经历", ok: resume.internshipExperiences.some((item) => !!item.companyName.trim()) },
    { key: "projects", label: "项目经历", ok: resume.projects.some((item) => !!item.projectName.trim()) },
    { key: "skills", label: "技能与证书", ok: resume.skills.length > 0 || resume.certificates.length > 0 },
    { key: "awards", label: "获奖经历", ok: resume.awards.some((item) => !!item.awardName.trim()) },
    { key: "personalExperiences", label: "个人经历", ok: resume.personalExperiences.some((item) => !!item.experienceTitle.trim()) },
  ];

  for (const check of resumeChecks) {
    resumeTotal += 1;
    if (check.ok) {
      resumeFilled += 1;
    } else {
      missingResumeSections.push(check.label);
      missingResumeSectionKeys.push(check.key);
    }
  }

  let appFilled = 0;
  let appTotal = 0;
  const missingApplicationSections: string[] = [];

  const missingApplicationSectionKeys: string[] = [];
  const appChecks: Array<{ key: string; label: string; ok: boolean }> = [
    { key: "identityContact", label: "身份与联系信息", ok: !!app.identityContact.chineseName.trim() || !!app.identityContact.phone.trim() },
    { key: "jobPreference", label: "求职偏好", ok: !!app.jobPreference.expectedPosition.trim() || app.jobPreference.expectedCities.length > 0 },
    { key: "campusFields", label: "校招专项", ok: !!app.campusFields.isFreshGraduate.trim() || !!app.campusFields.graduationDate.trim() },
    { key: "relationshipCompliance", label: "关系与合规信息", ok: app.relationshipCompliance.familyMembers.length > 0 || !!app.relationshipCompliance.backgroundCheckAuthorization.trim() },
    { key: "sourceReferral", label: "来源与推荐", ok: !!app.sourceReferral.sourceChannel.trim() || !!app.sourceReferral.referralCode.trim() },
    { key: "attachments", label: "附件材料", ok: hasAttachment(app.attachments.resumeZh) || hasAttachment(app.attachments.resumeEn) || app.attachments.otherAttachments.length > 0 },
  ];

  for (const check of appChecks) {
    appTotal += 1;
    if (check.ok) {
      appFilled += 1;
    } else {
      missingApplicationSections.push(check.label);
      missingApplicationSectionKeys.push(check.key);
    }
  }

  const missingFieldCount = missingResumeSections.length + missingApplicationSections.length;
  const syncableFieldCount = SHARED_ROOT_PATHS.length - archive.syncSettings.overriddenFieldPaths.length;

  return {
    resumeCompleteness: Math.round((resumeFilled / Math.max(resumeTotal, 1)) * 100),
    applicationCompleteness: Math.round((appFilled / Math.max(appTotal, 1)) * 100),
    missingFieldCount,
    syncableFieldCount: Math.max(syncableFieldCount, 0),
    missingResumeSections,
    missingResumeSectionKeys,
    missingApplicationSections,
    missingApplicationSectionKeys,
  };
}

function setByPath(target: Record<string, any>, path: string, value: any): void {
  const keys = path.split(".");
  let current: Record<string, any> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

function getByPath(source: Record<string, any>, path: string): any {
  const keys = path.split(".");
  let current: any = source;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function mapSharedPathToResume(path: string): string {
  if (path === "personalSummary") return "personalSummary";
  return path;
}

function mapSharedPathToApplication(path: string): string {
  if (path === "personalSummary") return "applicationArchive.shared.personalSummary";
  return `applicationArchive.shared.${path}`;
}

function mapResumePathToRoot(path: string): string {
  if (path === "personalSummary") return "resumeArchive.personalSummary";
  return `resumeArchive.${path}`;
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map((item) => item.trim()).filter(Boolean)));
}

export function applyResumeToApplicationSync(
  archive: PersonalArchive,
  changedPaths: string[],
  forceOverride = false
): SyncResult {
  const nextArchive = cloneArchive(archive);
  const uniqueChanged = uniquePaths(changedPaths);
  const syncedPaths: string[] = [];
  const skippedOverriddenPaths: string[] = [];

  for (const sharedPath of uniqueChanged) {
    if (!SHARED_ROOT_PATHS.includes(sharedPath as (typeof SHARED_ROOT_PATHS)[number])) {
      continue;
    }
    const overridden = nextArchive.syncSettings.overriddenFieldPaths.includes(sharedPath);
    if (overridden && !forceOverride) {
      skippedOverriddenPaths.push(sharedPath);
      continue;
    }

    const sourcePath = mapResumePathToRoot(sharedPath);
    const sourceValue = getByPath(nextArchive as Record<string, any>, sourcePath);
    const targetPath = mapSharedPathToApplication(sharedPath);
    setByPath(nextArchive as Record<string, any>, targetPath, JSON.parse(JSON.stringify(sourceValue)));

    if (forceOverride && overridden) {
      nextArchive.syncSettings.overriddenFieldPaths = nextArchive.syncSettings.overriddenFieldPaths.filter(
        (item) => item !== sharedPath
      );
    }

    syncedPaths.push(sharedPath);
  }

  nextArchive.updatedAt = nowIso();
  return {
    nextArchive,
    syncedPaths,
    skippedOverriddenPaths,
  };
}

export function markApplicationOverride(archive: PersonalArchive, sharedPath: string): PersonalArchive {
  if (!SHARED_ROOT_PATHS.includes(sharedPath as (typeof SHARED_ROOT_PATHS)[number])) {
    return archive;
  }
  if (archive.syncSettings.overriddenFieldPaths.includes(sharedPath)) {
    return archive;
  }

  const next = cloneArchive(archive);
  next.syncSettings.overriddenFieldPaths.push(sharedPath);
  next.updatedAt = nowIso();
  return next;
}

export function clearApplicationOverride(archive: PersonalArchive, sharedPath: string): PersonalArchive {
  if (!archive.syncSettings.overriddenFieldPaths.includes(sharedPath)) {
    return archive;
  }
  const next = cloneArchive(archive);
  next.syncSettings.overriddenFieldPaths = next.syncSettings.overriddenFieldPaths.filter(
    (item) => item !== sharedPath
  );
  next.updatedAt = nowIso();
  return next;
}

export function buildProfileBaseInfoForSave(
  baseInfoJson: Record<string, any> | undefined,
  archive: PersonalArchive
): Record<string, any> {
  const base = baseInfoJson && typeof baseInfoJson === "object" ? { ...baseInfoJson } : {};
  const resume = archive.resumeArchive;
  return {
    ...base,
    name: resume.basicInfo.name,
    phone: resume.basicInfo.phone,
    email: resume.basicInfo.email,
    website: resume.basicInfo.website,
    github: resume.basicInfo.github,
    current_city: resume.basicInfo.currentCity,
    job_intention: resume.basicInfo.jobIntention,
    summary: resume.personalSummary,
    personal_summary: resume.personalSummary,
    personal_archive: archive,
  };
}

function hashStable(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function toSyntheticSectionId(seed: string, index: number): number {
  const base = hashStable(seed) % 900000;
  return 1000000 + base + index;
}

function listToBullet(lines: string[]): string {
  return descriptionLinesToPlainText(lines);
}

function buildSection(
  id: number,
  sectionType: string,
  categoryKey: string,
  categoryLabel: string,
  title: string,
  normalized: Record<string, any>,
  updatedAt: string,
  sortOrder: number
): ProfileSection {
  return {
    id,
    profile_id: 0,
    section_type: sectionType,
    raw_section_type: sectionType,
    category_key: categoryKey,
    category_label: categoryLabel,
    is_custom_category: categoryKey.startsWith("custom:"),
    parent_id: null,
    title,
    sort_order: sortOrder,
    content_json: {
      normalized,
      bullet: listToBullet([
        title,
        textFromHtml(asString(normalized.description)),
      ]),
    },
    source: "manual",
    confidence: 1,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

function buildResumeArchiveSyntheticSections(archive: ResumeArchive, updatedAt: string): ProfileSection[] {
  const sections: ProfileSection[] = [];
  let index = 0;

  for (const item of archive.education) {
    const sortOrder = index++;
    sections.push(
      buildSection(
        toSyntheticSectionId(`edu-${item.id}`, sortOrder),
        "education",
        "education",
        "教育经历",
        item.schoolName || "教育经历",
        {
          school: item.schoolName,
          degree: item.degree || item.educationLevel,
          major: item.major,
          start_date: item.startDate,
          end_date: item.endDate,
          gpa: item.gpa,
          description: item.description,
        },
        updatedAt,
        sortOrder
      )
    );
  }

  for (const item of archive.workExperiences) {
    const sortOrder = index++;
    sections.push(
      buildSection(
        toSyntheticSectionId(`work-${item.id}`, sortOrder),
        "experience",
        "experience",
        "工作经历",
        item.companyName || "工作经历",
        {
          company: item.companyName,
          department: item.department,
          position: item.positionName,
          start_date: item.startDate,
          end_date: item.endDate,
          description: item.description,
        },
        updatedAt,
        sortOrder
      )
    );
  }

  for (const item of archive.internshipExperiences) {
    const sortOrder = index++;
    sections.push(
      buildSection(
        toSyntheticSectionId(`intern-${item.id}`, sortOrder),
        "experience",
        "custom:c_internship",
        "实习经历",
        item.companyName || "实习经历",
        {
          company: item.companyName,
          position: item.positionName,
          start_date: item.startDate,
          end_date: item.endDate,
          description: item.description,
        },
        updatedAt,
        sortOrder
      )
    );
  }

  for (const item of archive.projects) {
    const sortOrder = index++;
    sections.push(
      buildSection(
        toSyntheticSectionId(`project-${item.id}`, sortOrder),
        "project",
        "project",
        "项目经历",
        item.projectName || "项目经历",
        {
          name: item.projectName,
          role: item.projectRole,
          url: item.projectLink,
          start_date: item.startDate,
          end_date: item.endDate,
          description: item.description,
        },
        updatedAt,
        sortOrder
      )
    );
  }

  const skillGroups = new Map<string, { names: string[]; remarks: string[] }>();
  for (const item of archive.skills) {
    const key = asString(item.proficiency) || "技能";
    if (!skillGroups.has(key)) skillGroups.set(key, { names: [], remarks: [] });
    const name = asString(item.skillName);
    if (name) skillGroups.get(key)!.names.push(name);
    const remark = asString(item.remark);
    if (remark) skillGroups.get(key)!.remarks.push(remark);
  }
  for (const [proficiency, group] of skillGroups) {
    const sortOrder = index++;
    sections.push(
      buildSection(
        toSyntheticSectionId(`skill-${proficiency}`, sortOrder),
        "skill",
        "skill",
        "技能与证书",
        proficiency,
        {
          category: proficiency,
          items: group.names,
          description: group.remarks.length > 0 ? group.remarks.join("\n") : "",
        },
        updatedAt,
        sortOrder
      )
    );
  }

  for (const item of archive.certificates) {
    const sortOrder = index++;
    sections.push(
      buildSection(
        toSyntheticSectionId(`cert-${item.id}`, sortOrder),
        "certificate",
        "certificate",
        "技能与证书",
        item.certificateName || "证书",
        {
          name: item.certificateName,
          issuer: item.issuer,
          date: item.acquiredAt,
          score: item.scoreOrLevel,
          description: item.scoreOrLevel,
        },
        updatedAt,
        sortOrder
      )
    );
  }

  for (const item of archive.awards) {
    const sortOrder = index++;
    sections.push(
      buildSection(
        toSyntheticSectionId(`award-${item.id}`, sortOrder),
        "custom:c_awards",
        "custom:c_awards",
        "获奖经历",
        item.awardName || "获奖经历",
        {
          description: item.description,
          issuer: item.issuer,
          date: item.awardedAt,
        },
        updatedAt,
        sortOrder
      )
    );
  }

  for (const item of archive.personalExperiences) {
    const sortOrder = index++;
    sections.push(
      buildSection(
        toSyntheticSectionId(`personal-${item.id}`, sortOrder),
        "custom:c_personal",
        "custom:c_personal",
        "个人经历",
        item.experienceTitle || "个人经历",
        {
          start_date: item.startDate,
          end_date: item.endDate,
          description: item.description,
        },
        updatedAt,
        sortOrder
      )
    );
  }

  return sections;
}

export function buildProfileSectionsForResumeImport(profileData: ProfileData | null | undefined): ProfileSection[] {
  const sections = (profileData?.sections || []).slice();
  const base = profileData?.base_info_json || {};
  const rawArchive = base.personal_archive as PersonalArchive | undefined;
  if (!rawArchive || rawArchive.schemaVersion !== "personal.archive.v1") {
    return sections;
  }
  const resumeArchive = normalizeResumeArchiveCandidate(rawArchive.resumeArchive);

  const synthetic = buildResumeArchiveSyntheticSections(
    resumeArchive,
    rawArchive.updatedAt || nowIso()
  );

  if (synthetic.length === 0) return sections;
  if (sections.length === 0) return synthetic;

  const merged: ProfileSection[] = [];
  const seen = new Set<string>();

  const pushUnique = (item: ProfileSection) => {
    const content = item.content_json && typeof item.content_json === "object"
      ? (item.content_json as Record<string, any>)
      : {};
    const normalized = content.normalized && typeof content.normalized === "object"
      ? JSON.stringify(content.normalized)
      : "";
    const bullet = asString(content.bullet || "");
    const key = [
      asString(item.category_key || item.section_type).toLowerCase(),
      asString(item.title || ""),
      normalized,
      bullet,
    ].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  synthetic.forEach(pushUnique);
  sections.forEach(pushUnique);
  return merged;
}

function compactList<T>(items: T[], predicate: (item: T) => boolean): T[] {
  return items.filter(predicate);
}

export function sanitizePersonalArchive(archive: PersonalArchive): PersonalArchive {
  const next = cloneArchive(archive);

  next.resumeArchive.education = compactList(next.resumeArchive.education, (item) => {
    return !!asString(item.schoolName).trim() || !!asString(item.description).trim();
  });
  next.resumeArchive.workExperiences = compactList(next.resumeArchive.workExperiences, (item) => {
    return !!asString(item.companyName).trim() || !!asString(item.description).trim();
  });
  next.resumeArchive.internshipExperiences = compactList(next.resumeArchive.internshipExperiences, (item) => {
    return !!asString(item.companyName).trim() || !!asString(item.description).trim();
  });
  next.resumeArchive.projects = compactList(next.resumeArchive.projects, (item) => {
    return !!asString(item.projectName).trim() || !!asString(item.description).trim();
  });
  next.resumeArchive.skills = compactList(next.resumeArchive.skills, (item) => {
    return !!asString(item.skillName).trim();
  });
  next.resumeArchive.certificates = compactList(next.resumeArchive.certificates, (item) => {
    return !!asString(item.certificateName).trim();
  });
  next.resumeArchive.awards = compactList(next.resumeArchive.awards, (item) => {
    return !!asString(item.awardName).trim() || !!asString(item.description).trim();
  });
  next.resumeArchive.personalExperiences = compactList(next.resumeArchive.personalExperiences, (item) => {
    return !!asString(item.experienceTitle).trim() || !!asString(item.description).trim();
  });

  next.applicationArchive.shared = JSON.parse(JSON.stringify(next.applicationArchive.shared));
  next.updatedAt = nowIso();
  return next;
}

export function buildAutofillProfile(archive: PersonalArchive): Record<string, any> {
  const resume = archive.resumeArchive;
  const app = archive.applicationArchive;
  return {
    profileVersion: archive.schemaVersion,
    basic: {
      fullName: resume.basicInfo.name,
      phone: resume.basicInfo.phone,
      email: resume.basicInfo.email,
      city: resume.basicInfo.currentCity,
      targetRole: resume.basicInfo.jobIntention,
      website: resume.basicInfo.website,
      github: resume.basicInfo.github,
      summary: resume.personalSummary,
    },
    resumeArchive: resume,
    applicationArchive: app,
    syncSettings: archive.syncSettings,
  };
}

/**
 * 该方法为未来浏览器插件一键填充能力预留。当前阶段仅导出本地结构化档案数据，不执行网页填充。
 */
export function getResumeArchive(archive: PersonalArchive): ResumeArchive {
  return JSON.parse(JSON.stringify(archive.resumeArchive)) as ResumeArchive;
}

/**
 * 该方法为未来浏览器插件一键填充能力预留。当前阶段仅导出本地结构化档案数据，不执行网页填充。
 */
export function getApplicationArchive(archive: PersonalArchive): ApplicationArchive {
  return JSON.parse(JSON.stringify(archive.applicationArchive)) as ApplicationArchive;
}

/**
 * 该方法为未来浏览器插件一键填充能力预留。当前阶段仅导出本地结构化档案数据，不执行网页填充。
 */
export function getAutofillProfile(archive: PersonalArchive): Record<string, any> {
  return buildAutofillProfile(archive);
}

export const personalArchiveFactories = {
  createEmptyEducation,
  createEmptyWork,
  createEmptyInternship,
  createEmptyProject,
  createEmptySkill,
  createEmptyCertificate,
  createEmptyAward,
  createEmptyPersonalExperience,
};

