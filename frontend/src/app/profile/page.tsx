"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Spinner } from "@nextui-org/react";
import {
  type ArchiveTab,
  type PersonalArchive,
  createDefaultPersonalArchive,
  normalizePersonalArchiveFromProfile,
  computeArchiveCompleteness,
  applyResumeToApplicationSync,
  markApplicationOverride,
  clearApplicationOverride,
  getResumeArchive,
  getApplicationArchive,
  SHARED_ROOT_PATHS,
  sanitizePersonalArchive,
  buildProfileBaseInfoForSave,
} from "@/lib/personalArchive";
import { importProfileResume, updateProfileData, useProfile } from "@/lib/hooks";
import ArchiveIntroCard from "./components/archive/ArchiveIntroCard";
import ArchiveCompletenessBar from "./components/archive/ArchiveCompletenessBar";
import ArchiveTabsHeader from "./components/archive/ArchiveTabsHeader";
import ArchiveSettingsDialog from "./components/archive/ArchiveSettingsDialog";
import ResumeArchiveEditor from "./components/archive/ResumeArchiveEditor";
import ApplicationArchiveEditor from "./components/archive/ApplicationArchiveEditor";

export default function ProfilePage() {
  const { data: profile, mutate, isLoading } = useProfile();

  const [archive, setArchive] = useState<PersonalArchive>(createDefaultPersonalArchive);
  const [activeTab, setActiveTab] = useState<ArchiveTab>("resume");
  const [focusSection, setFocusSection] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastProfileArchiveUpdatedAtRef = useRef("");
  const archiveDirtyRef = useRef(false);

  // Sync archive from profile data
  useEffect(() => {
    if (!profile) return;
    const fromProfile = normalizePersonalArchiveFromProfile(profile);
    const incomingStamp = fromProfile.updatedAt || String(profile.updated_at || "");
    lastProfileArchiveUpdatedAtRef.current = incomingStamp;
    if (!archiveDirtyRef.current) {
      setArchive(fromProfile);
    }
  }, [profile]);

  const metrics = useMemo(() => computeArchiveCompleteness(archive), [archive]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(timer);
  }, [notice]);

  // === Save ===
  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      const sanitized = sanitizePersonalArchive(archive);
      const baseInfoPayload = buildProfileBaseInfoForSave(profile?.base_info_json, sanitized);
      await updateProfileData({
        name: sanitized.resumeArchive.basicInfo.name || "默认档案",
        base_info_json: { ...(profile?.base_info_json || {}), ...baseInfoPayload },
      });
      archiveDirtyRef.current = false;
      await mutate();
      setNotice("档案已保存");
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // === Import ===
  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setImporting(true);
      setError("");
      const result = await importProfileResume(file);
      const importedBase = result.base_info || {};
      const importedBaseInfo = {
        ...(profile?.base_info_json || {}),
        personal_archive: undefined,
        ...importedBase,
      };
      // Merge imported data into archive
      const rawArchive = normalizePersonalArchiveFromProfile({
        ...profile,
        name: importedBase.name || profile?.name || "",
        base_info_json: importedBaseInfo,
        sections: result.bullets?.map((b: any) => ({
          ...b,
          category_key: b.section_type,
          category_label: "",
          title: b.title || "",
          content_json: b.content_json || {},
          confidence: b.confidence ?? 0.7,
          source: "ai_import",
        })) || [],
      } as any);
      rawArchive.resumeArchive.basicInfo = {
        ...rawArchive.resumeArchive.basicInfo,
        name: importedBase.name || rawArchive.resumeArchive.basicInfo.name,
        phone: importedBase.phone || rawArchive.resumeArchive.basicInfo.phone,
        email: importedBase.email || rawArchive.resumeArchive.basicInfo.email,
        currentCity: importedBase.current_city || rawArchive.resumeArchive.basicInfo.currentCity,
        jobIntention: importedBase.job_intention || rawArchive.resumeArchive.basicInfo.jobIntention,
        website: importedBase.website || rawArchive.resumeArchive.basicInfo.website,
        github: importedBase.github || rawArchive.resumeArchive.basicInfo.github,
      };

      const importedSummary = importedBase.summary || importedBase.personal_summary;
      if (importedSummary && !rawArchive.resumeArchive.personalSummary) {
        rawArchive.resumeArchive.personalSummary = importedSummary;
      }

      const syncedArchive = applyResumeToApplicationSync(rawArchive, [...SHARED_ROOT_PATHS], true).nextArchive;
      const basicInfo = syncedArchive.resumeArchive.basicInfo;
      syncedArchive.applicationArchive.identityContact = {
        ...syncedArchive.applicationArchive.identityContact,
        chineseName: basicInfo.name || syncedArchive.applicationArchive.identityContact.chineseName,
        phone: basicInfo.phone || syncedArchive.applicationArchive.identityContact.phone,
        email: basicInfo.email || syncedArchive.applicationArchive.identityContact.email,
        currentCity: basicInfo.currentCity || syncedArchive.applicationArchive.identityContact.currentCity,
      };
      syncedArchive.applicationArchive.jobPreference = {
        ...syncedArchive.applicationArchive.jobPreference,
        expectedPosition: basicInfo.jobIntention || syncedArchive.applicationArchive.jobPreference.expectedPosition,
      };
      archiveDirtyRef.current = true;
      setArchive(syncedArchive);
      setNotice(`已导入 ${file.name}`);
    } catch (err: any) {
      setError(err.message || "导入失败");
    } finally {
      setImporting(false);
    }
  };

  // === Jump / Focus ===
  const handleJump = (target: "resume" | "application" | "missing" | "syncable") => {
    if (target === "resume") {
      setActiveTab("resume");
      setFocusSection(metrics.missingResumeSectionKeys[0] || undefined);
    } else if (target === "application") {
      setActiveTab("application");
      setFocusSection(metrics.missingApplicationSectionKeys[0] || undefined);
    } else if (target === "missing") {
      const firstMissing =
        metrics.missingResumeSectionKeys[0] || metrics.missingApplicationSectionKeys[0];
      if (firstMissing) {
        setActiveTab(
          metrics.missingResumeSectionKeys.includes(firstMissing) ? "resume" : "application"
        );
        setFocusSection(firstMissing);
      }
    } else if (target === "syncable") {
      setSettingsOpen(true);
    }
  };

  // === Sync ===
  const handleOneClickSync = () => {
    try {
      setSyncing(true);
      setError("");
      const { nextArchive, syncedPaths } = applyResumeToApplicationSync(archive, [...SHARED_ROOT_PATHS]);
      archiveDirtyRef.current = true;
      setArchive(nextArchive);
      setNotice(syncedPaths.length > 0 ? `已同步 ${syncedPaths.length} 个字段` : "无需同步");
    } catch (err: any) {
      setError(err.message || "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  // === Override ===
  const handleToggleOverride = (path: string, enabled: boolean) => {
    archiveDirtyRef.current = true;
    setArchive((prev) =>
      enabled ? markApplicationOverride(prev, path) : clearApplicationOverride(prev, path)
    );
  };

  const handleRequestEditShared = (path: string) => {
    setActiveTab("resume");
    setFocusSection(path);
  };

  // === Loading ===
  if (isLoading && !profile) {
    return (
      <div className="grid h-[70vh] place-items-center">
        <div className="bauhaus-panel flex items-center gap-3 bg-white px-6 py-5 text-sm font-medium text-black/70">
          <Spinner color="warning" />
          <span>正在加载档案...</span>
        </div>
      </div>
    );
  }

  const missingSections = activeTab === "resume"
    ? metrics.missingResumeSectionKeys
    : metrics.missingApplicationSectionKeys;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 18 }}
      className="space-y-5"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={handleFileChange}
        disabled={importing}
      />

      {/* Header */}
      <ArchiveIntroCard
        onImport={triggerImport}
        onSave={handleSave}
        saving={saving}
        importing={importing}
      />

      {/* Completeness */}
      <ArchiveCompletenessBar metrics={metrics} onJump={handleJump} />

      {/* Tabs */}
      <ArchiveTabsHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setFocusSection(undefined);
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Error / Notice */}
      {error && (
        <div className="bauhaus-panel-sm bg-[#D02020] px-4 py-3 text-sm font-medium text-white">
          {error}
        </div>
      )}
      {notice && (
        <div className="bauhaus-panel-sm bg-[#F0C020] px-4 py-3 text-sm font-medium text-black">
          {notice}
        </div>
      )}

      {/* Editor */}
      {activeTab === "resume" ? (
        <ResumeArchiveEditor
          value={getResumeArchive(archive)}
          focusSection={focusSection}
          missingSections={missingSections}
          saving={saving}
          onChange={(nextResume, changedPaths) => {
            archiveDirtyRef.current = true;
            setArchive((prev) => ({
              ...prev,
              updatedAt: new Date().toISOString(),
              resumeArchive: nextResume,
            }));
            if (archive.syncSettings.autoSyncEnabled && changedPaths.length > 0) {
              // Auto-sync in background
              const synced = applyResumeToApplicationSync({
                ...archive,
                resumeArchive: nextResume,
              }, changedPaths);
              if (synced.syncedPaths.length > 0) {
                archiveDirtyRef.current = true;
                setArchive(synced.nextArchive);
                return;
              }
            }
          }}
          onSaveItem={handleSave}
        />
      ) : (
        <ApplicationArchiveEditor
          value={getApplicationArchive(archive)}
          resumeArchive={getResumeArchive(archive)}
          overriddenPaths={archive.syncSettings.overriddenFieldPaths}
          focusSection={focusSection}
          missingSections={missingSections}
          saving={saving}
          onChange={(nextApp) => {
            archiveDirtyRef.current = true;
            setArchive((prev) => ({
              ...prev,
              updatedAt: new Date().toISOString(),
              applicationArchive: nextApp,
            }));
          }}
          onToggleOverride={handleToggleOverride}
          onRequestEditSharedModule={handleRequestEditShared}
          onSaveItem={handleSave}
        />
      )}

      {/* Settings Dialog */}
      <ArchiveSettingsDialog
        open={settingsOpen}
        autoSyncEnabled={archive.syncSettings.autoSyncEnabled}
        onClose={() => setSettingsOpen(false)}
        onAutoSyncChange={(next) =>
          {
            archiveDirtyRef.current = true;
            setArchive((prev) => ({
              ...prev,
              syncSettings: { ...prev.syncSettings, autoSyncEnabled: next },
            }));
          }
        }
        onOneClickSync={handleOneClickSync}
        syncing={syncing}
      />
    </motion.div>
  );
}
