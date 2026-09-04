"use client";

import { useEffect, useMemo, useState } from "react";
import { FileVideo, Images, MapPin, Radio, UploadCloud, X } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import {
  EmptyState,
  ErrorState,
  Skeleton,
} from "../../../components/ui/States";
import {
  useDeleteEvidence,
  useEvidenceGallery,
} from "../../../hooks/useEvidence";
import { evidenceMediaUrl } from "../../../lib/api";
import { useLanguage } from "../../../lib/i18n";
import { timeAgo } from "../../../lib/utils";
import type { TranslationKey } from "../../../lib/dictionaries";
import type { EvidenceRecord } from "../../../types";

const DISASTER_LABEL: Record<string, TranslationKey> = {
  flood: "disaster.flood",
  earthquake: "disaster.earthquake",
  fire: "disaster.fire",
  building_collapse: "disaster.building_collapse",
  landslide: "disaster.landslide",
  storm: "disaster.storm",
  other: "disaster.other",
};

const STATUS_LABEL: Record<string, TranslationKey> = {
  standing: "registerCase.analysisStanding",
  sitting: "registerCase.analysisSitting",
  collapsed: "registerCase.analysisCollapsed",
};

/** Translate a Qwen-VL disaster type; unknown values fall back to a readable raw string. */
function formatDisasterType(
  type: string | null | undefined,
  t: (key: TranslationKey) => string,
): string {
  if (!type) return "—";
  return DISASTER_LABEL[type]
    ? t(DISASTER_LABEL[type])
    : type.replace(/_/g, " ");
}

function formatVictimStatus(
  status: string | null | undefined,
  t: (key: TranslationKey) => string,
): string {
  if (!status) return "—";
  return STATUS_LABEL[status] ? t(STATUS_LABEL[status]) : status;
}

function formatEvidenceLocation(record: EvidenceRecord): string {
  const label = record.location?.label?.trim();
  if (label && !/^(reported location|unknown)$/i.test(label)) return label;
  if (record.location?.lat != null && record.location?.lng != null) {
    return `${record.location.lat}, ${record.location.lng}`;
  }
  return "Location unavailable";
}

/** One gallery tile: thumbnail/preview plus its AI triage summary. */
function EvidenceTile({
  record,
  onOpen,
  onDelete,
}: {
  record: EvidenceRecord;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const { t, language } = useLanguage();
  const thumb = evidenceMediaUrl(record.thumbnailUrl ?? record.mediaUrl);
  const analysis = record.analysis;
  const trapped = record.trapped === "yes" || record.trapped === "partial";

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-bg/50 transition-colors hover:border-secondary/60">
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute right-1.5 top-1.5 z-10 rounded bg-black/70 p-1 text-white transition-colors hover:bg-red-600"
          aria-label={t("connect.deleteEvidence")}
          title={t("connect.deleteEvidence")}
        >
          <X size={12} />
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        title={t("connect.openMedia")}
        className="block w-full text-left"
      >
        <div className="relative h-48 bg-black/40">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- evidence media is served by the backend's /media mount
            <img
              src={thumb}
              alt={record.id}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Images size={20} className="text-text-faint" />
            </div>
          )}
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">
            {record.source === "stream" ? (
              <Radio size={10} />
            ) : (
              <UploadCloud size={10} />
            )}
            {record.source === "stream"
              ? t("connect.sourceStream")
              : t("connect.sourceUpload")}
          </span>
          {record.mediaType === "video" && (
            <span className="absolute inset-0 flex items-center justify-center">
              <FileVideo size={22} className="text-white/90 drop-shadow" />
            </span>
          )}
          {trapped && (
            <span className="absolute right-2 top-9 rounded bg-red-600 px-2 py-1 text-sm font-bold text-white">
              {t("connect.trappedFlag")}
            </span>
          )}
        </div>
        <div className="space-y-1 p-2.5">
          {analysis ? (
            <>
              <p className="text-sm font-semibold text-text">
                {formatDisasterType(analysis.disasterType, t)} ·{" "}
                {formatVictimStatus(analysis.status, t)}
                <span className="ml-1 font-normal text-text-faint">
                  {Math.round(analysis.confidence * 100)}%{" "}
                  {t("connect.aiConfidence")}
                </span>
              </p>
              {analysis.hazards.length > 0 && (
                <p
                  className="truncate text-[11px] text-text-faint"
                  title={analysis.hazards.join(", ")}
                >
                  {analysis.hazards.join(", ")}
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-text-faint">
              {t("connect.noAnalysis")}
            </p>
          )}
          <p className="flex items-center gap-1 truncate text-xs text-text-muted">
            <MapPin size={12} className="shrink-0 text-secondary" />
            <span className="truncate" title={formatEvidenceLocation(record)}>
              {formatEvidenceLocation(record)}
            </span>
          </p>
          <p className="text-[10px] text-text-faint">
            {timeAgo(record.receivedAt, language)}
            {record.caseId
              ? ` · ${t("connect.linkedCase")} ${record.caseId}`
              : ""}
          </p>
        </div>
      </button>
    </div>
  );
}

function EvidenceLightbox({
  record,
  onClose,
}: {
  record: EvidenceRecord;
  onClose: () => void;
}) {
  const { t, language } = useLanguage();
  const media = evidenceMediaUrl(record.mediaUrl);
  const analysis = record.analysis;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl lg:flex-row"
        role="dialog"
        aria-modal="true"
        aria-label={t("connect.evidenceTitle")}
      >
        <div className="flex min-h-64 flex-1 items-center justify-center bg-black p-4 lg:min-h-[560px]">
          {media && record.mediaType === "video" ? (
            <video src={media} controls className="max-h-[70vh] max-w-full" />
          ) : media ? (
            // eslint-disable-next-line @next/next/no-img-element -- evidence media is served by the backend's /media mount
            <img
              src={media}
              alt={record.id}
              className="max-h-[70vh] max-w-full object-contain"
            />
          ) : (
            <Images size={40} className="text-text-faint" />
          )}
        </div>

        <div className="relative min-w-0 flex-1 overflow-y-auto p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-2 text-text-muted transition-colors hover:bg-bg hover:text-text"
            aria-label={t("connect.closeEvidence")}
            title={t("connect.closeEvidence")}
          >
            <X size={18} />
          </button>
          <h2 className="pr-10 text-lg font-semibold text-text">
            {t("connect.evidenceTitle")}
          </h2>
          <p className="mt-1 text-xs text-text-faint">
            {timeAgo(record.receivedAt, language)}
          </p>

          <section className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              GPS
            </h3>
            <p className="mt-2 text-sm text-text">
              {record.location?.lat != null && record.location?.lng != null
                ? `${record.location.lat}, ${record.location.lng}`
                : "No coordinates available"}
            </p>
            {record.location?.label && (
              <p className="mt-1 text-xs text-text-faint">
                {record.location.label}
              </p>
            )}
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              Qwen-VL diagnostic output
            </h3>
            {analysis ? (
              <dl className="mt-3 space-y-3 rounded-lg border border-border bg-bg/50 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-text-faint">Disaster type</dt>
                  <dd className="text-right font-medium text-text">
                    {formatDisasterType(analysis.disasterType, t)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-faint">Victim status</dt>
                  <dd className="text-right font-medium text-text">
                    {formatVictimStatus(analysis.status, t)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-faint">
                    {t("connect.aiConfidence")}
                  </dt>
                  <dd className="text-right font-medium text-text">
                    {Math.round(analysis.confidence * 100)}%{" "}
                    {t("connect.aiConfidence")}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-faint">Hazards</dt>
                  <dd className="mt-1 text-text">
                    {analysis.hazards.length
                      ? analysis.hazards.join(", ")
                      : "None detected"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 rounded-lg border border-border bg-bg/50 p-4 text-sm text-text-faint">
                {t("connect.noAnalysis")}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  const { t } = useLanguage();
  const [selectedEvidence, setSelectedEvidence] =
    useState<EvidenceRecord | null>(null);

  const evidenceQuery = useEvidenceGallery();
  const evidence = useMemo(
    () => evidenceQuery.data ?? [],
    [evidenceQuery.data],
  );
  const deleteEvidence = useDeleteEvidence();

  const stats = useMemo(
    () => ({
      uploads: evidence.filter((e) => e.source === "upload").length,
      streams: evidence.filter((e) => e.source === "stream").length,
      trapped: evidence.filter(
        (e) => e.trapped === "yes" || e.trapped === "partial",
      ).length,
    }),
    [evidence],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Incoming evidence — every victim photo, video, and live-stream frame */}
      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text">
              {t("connect.evidenceTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-text-faint">
              {t("connect.evidenceHint")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-border bg-bg px-2.5 py-1 font-medium text-text-muted">
              {evidence.length} {t("connect.statTotal")}
            </span>
            <span className="rounded-lg border border-border bg-bg px-2.5 py-1 font-medium text-text-muted">
              {stats.uploads} {t("connect.statUploads")}
            </span>
            <span className="rounded-lg border border-border bg-bg px-2.5 py-1 font-medium text-text-muted">
              {stats.streams} {t("connect.statStreams")}
            </span>
            {stats.trapped > 0 && (
              <span className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 font-semibold text-red-400">
                {stats.trapped} {t("connect.statTrapped")}
              </span>
            )}
          </div>
        </div>

        {evidenceQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full" />
            ))}
          </div>
        ) : evidenceQuery.isError ? (
          <ErrorState />
        ) : evidence.length === 0 ? (
          <EmptyState
            message={t("connect.evidenceEmpty")}
            hint={t("connect.evidenceEmptyHint")}
          />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 p-2 md:grid-cols-2 lg:grid-cols-3">
            {evidence.map((record) => (
              <EvidenceTile
                key={record.id}
                record={record}
                onOpen={() => setSelectedEvidence(record)}
                onDelete={() => deleteEvidence.mutate(record.id)}
              />
            ))}
          </div>
        )}
      </Card>
      {selectedEvidence && (
        <EvidenceLightbox
          record={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </div>
  );
}
