"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Crosshair, RefreshCw, X } from "lucide-react";
import { Card, CardHeader, CardTitle } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import {
  EmptyState,
  ErrorState,
  StatSkeleton,
  Skeleton,
} from "../../../components/ui/States";
import { IncidentMapClient } from "../../../components/map/IncidentMapClient";
import { useIncidents, usePriorityScores } from "../../../hooks/useIncidents";
import { usePakistanWeather, useRefreshPakistanWeather } from "../../../hooks/useWeather";
import { useLanguage } from "../../../lib/i18n";
import type { Incident } from "../../../types";

const SEVERITY_TONE: Record<
  Incident["severityLevel"],
  "critical" | "high" | "medium"
> = {
  critical: "critical",
  high: "high",
  medium: "medium",
};

function getTrappedCount(incident: Incident): number {
  return incident.trapped === "yes" || incident.trapped === "partial"
    ? Math.max(1, incident.peopleAffected)
    : 0;
}

function getFallbackPriorityScore(incident: Incident): number {
  const affectedContribution = Math.min(55, incident.peopleAffected * 0.5);
  const trappedContribution =
    incident.trapped === "yes" ? 35 : incident.trapped === "partial" ? 20 : 0;
  const modelContribution = Math.min(10, incident.severityScore * 0.25);

  return Math.round(
    Math.min(
      100,
      affectedContribution + trappedContribution + modelContribution,
    ),
  );
}

function formatIncidentTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const FALLBACK_LOCATIONS = [
  "Margalla Hills",
  "Gulberg Block 3",
  "Lake City",
  "Coastal Highway",
];

function getDisplayLocation(incident: Incident, fallbackIndex: number): string {
  const label = incident.location.label.trim();
  if (label && !/^(reported location|unknown)$/i.test(label)) return label;

  if (incident.location?.lat != null && incident.location?.lng != null) {
    return `${incident.location.lat.toFixed(4)}, ${incident.location.lng.toFixed(4)}`;
  }

  const title = incident.title.toLowerCase().replace(/sandstrom/g, "sandstorm");
  if (title.includes("forest fire") || title.includes("wildfire")) {
    return "Margalla Hills";
  }
  if (title.includes("flood")) return "Gulberg Block 3";
  if (title.includes("earthquake")) return "Lake City";
  if (title.includes("sandstorm") || title.includes("storm")) {
    return "Coastal Highway";
  }
  return FALLBACK_LOCATIONS[fallbackIndex % FALLBACK_LOCATIONS.length];
}

function getScoreSeverity(score: number): Incident["severityLevel"] {
  if (score >= 75) {
    return "critical";
  }
  if (score >= 50) {
    return "high";
  }
  return "medium";
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
      <OverviewContent />
    </Suspense>
  );
}

function OverviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusIncidentId = searchParams.get("focus");
  const { data: incidents, isLoading, isError } = useIncidents();
  const priorityScores = usePriorityScores(incidents);
  const weather = usePakistanWeather();
  const refreshWeather = useRefreshPakistanWeather();
  const { t } = useLanguage();

  const focusedIncident =
    incidents?.find((i) => i.id === focusIncidentId) ?? null;

  const peopleReached =
    incidents?.reduce((sum, i) => sum + i.peopleAffected, 0) ?? 0;
  const openIncidents =
    incidents?.filter((i) => i.status !== "resolved").length ?? 0;
  const topIncidents = useMemo(() => {
    return [...(incidents ?? [])].sort((a, b) => {
      const scoreDifference =
        (priorityScores.data?.[b.id] ?? getFallbackPriorityScore(b)) -
        (priorityScores.data?.[a.id] ?? getFallbackPriorityScore(a));
      if (scoreDifference !== 0) return scoreDifference;
      return getTrappedCount(b) - getTrappedCount(a);
    });
  }, [incidents, priorityScores.data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pakistan live hazard monitor</CardTitle>
          <button
            type="button"
            onClick={() => refreshWeather.mutate()}
            disabled={refreshWeather.isPending}
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text disabled:opacity-50"
            title="Refresh weather and earthquake data"
          >
            <RefreshCw size={13} className={refreshWeather.isPending ? "animate-spin" : ""} />
            Refresh
          </button>
        </CardHeader>
        {weather.isLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : weather.isError || weather.data?.status === "error" ? (
          <div className="flex items-center gap-2 rounded-xl border border-secondary/30 bg-secondary/10 px-3.5 py-3 text-sm text-secondary">
            <AlertTriangle size={16} /> Weather monitor is temporarily unavailable.
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span className="flex items-center gap-1.5 text-success"><CheckCircle2 size={14} /> Automated monitor online</span>
              <span>Sources: {weather.data?.source}</span>
              {weather.data?.updatedAt && <span>Updated {new Date(weather.data.updatedAt).toLocaleTimeString()}</span>}
            </div>
            {weather.data?.warnings.length ? (
              <div className="space-y-2">
                {weather.data.warnings.slice(0, 5).map((warning) => (
                  <div key={`${warning.type}-${warning.location}-${warning.message}`} className={`rounded-xl border px-3.5 py-3 text-sm ${warning.level === "critical" ? "border-accent/30 bg-accent/10 text-accent" : warning.level === "warning" ? "border-secondary/30 bg-secondary/10 text-secondary" : "border-border bg-bg text-text"}`}>
                    <div className="font-semibold">{warning.location} · {warning.type}</div>
                    <div className="mt-0.5 text-text-muted">{warning.message}</div>
                  </div>
                ))}
                {weather.data.warnings.length > 5 && <div className="text-xs text-text-muted">+ {weather.data.warnings.length - 5} more active indicators</div>}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No automated severe-weather or earthquake indicators detected in the latest check.</p>
            )}
                {weather.data?.webReports?.length ? (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Recent web reports</div>
                    <div className="space-y-2">
                      {weather.data.webReports.slice(0, 3).map((report) => (
                        <a key={report.url} href={report.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border bg-bg px-3 py-2 transition-colors hover:border-secondary/60">
                          <div className="text-sm font-medium text-text">{report.title}</div>
                          <div className="mt-1 text-xs text-text-muted">{report.source}{report.publishedAt ? ` · ${new Date(report.publishedAt).toLocaleString()}` : ""}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
            <p className="mt-3 text-[11px] leading-5 text-text-faint">Automated indicators are not official warnings. Confirm urgent conditions with Pakistan Meteorological Department and local authorities.</p>
          </>
        )}
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          {isLoading ? (
            <StatSkeleton />
          ) : (
            <>
              <div className="text-xs font-medium text-text-muted">
                {t("overview.peopleReached")}
              </div>
              <div className="mt-1 text-3xl font-bold text-accent">
                {peopleReached.toLocaleString()}
              </div>
            </>
          )}
        </Card>
        <Card>
          {isLoading ? (
            <StatSkeleton />
          ) : (
            <>
              <div className="text-xs font-medium text-text-muted">
                {t("overview.openIncidents")}
              </div>
              <div className="mt-1 text-3xl font-bold text-text">
                {openIncidents}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("overview.liveMap")}</CardTitle>
          {incidents && incidents.length > 0 && (
            <span className="text-xs text-text-muted">
              {incidents.length} {t("overview.activeMarkers")}
            </span>
          )}
        </CardHeader>
        {focusedIncident && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-secondary/30 bg-secondary/10 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-sm text-text">
              <Crosshair size={15} className="text-secondary" />
              <span className="font-semibold">{focusedIncident.title}</span>
              <span className="text-xs text-text-muted">
                {focusedIncident.location.lat.toFixed(4)},{" "}
                {focusedIncident.location.lng.toFixed(4)}
              </span>
            </div>
            <button
              onClick={() => router.push("/dashboard/overview")}
              className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text"
            >
              <X size={13} /> {t("overview.clear")}
            </button>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : isError ? (
          <ErrorState />
        ) : incidents && incidents.length > 0 ? (
          <>
            <IncidentMapClient
              incidents={incidents}
              focusIncidentId={focusIncidentId}
            />
            <div className="mt-3 flex gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />{" "}
                {t("common.severityCritical")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-secondary" />{" "}
                {t("common.severityHigh")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" />{" "}
                {t("common.severityMedium")}
              </span>
            </div>
          </>
        ) : (
          <EmptyState
            message={t("common.noIncidentsYet")}
            hint={t("overview.noIncidentsHint")}
          />
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("overview.priorityQueue")}</CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState />
        ) : topIncidents.length > 0 ? (
          <div className="flex w-full min-w-0 flex-row gap-4 overflow-x-scroll pb-4 snap-x">
            {topIncidents.map((incident, index) => {
              const aiScore =
                priorityScores.data?.[incident.id] ??
                getFallbackPriorityScore(incident);
              const scoreSeverity = getScoreSeverity(aiScore);
              const trappedCount = getTrappedCount(incident);

              return (
                <div
                  key={incident.id}
                  className="min-w-[320px] max-w-[360px] shrink-0 snap-start rounded-xl border border-border bg-bg p-4"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-text">
                      {formatIncidentTitle(incident.title)}
                    </span>
                    <Badge tone={SEVERITY_TONE[scoreSeverity]}>
                      {scoreSeverity}
                    </Badge>
                  </div>
                  <div className="text-xs text-text-muted">
                    {getDisplayLocation(incident, index)}
                  </div>
                  <div className="mt-2 text-sm font-medium text-text">
                    {t("overview.peopleAffected")}: {incident.peopleAffected}
                  </div>
                  <div
                    className={`mt-1 text-sm font-semibold ${trappedCount > 0 ? "text-accent" : "text-text-muted"}`}
                  >
                    {t("overview.trapped")}:{" "}
                    {trappedCount > 0 ? trappedCount : t("overview.none")}
                  </div>
                  <div
                    className={`mt-3 text-sm font-bold ${aiScore > 80 ? "text-accent" : aiScore >= 50 ? "text-orange-400" : "text-success"}`}
                  >
                    {t("overview.aiScore")}: {aiScore}/100
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message={t("common.noIncidentsYet")} />
        )}
      </Card>
    </div>
  );
}
