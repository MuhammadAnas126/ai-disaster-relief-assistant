"use client";

import { FormEvent, useState } from "react";
import { ExternalLink, MapPin, Search, ScanSearch } from "lucide-react";
import { Card, CardHeader, CardTitle } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input, Label } from "../../../components/ui/Input";
import { SafeSpotAnalyzer } from "../../../components/map/SafeSpotAnalyzer";
import { SatelliteAnalysisMapClient } from "../../../components/map/SatelliteAnalysisMapClient";
import { useLanguage } from "../../../lib/i18n";

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

const DEFAULT_LOCATION = {
  label: "Karachi, Pakistan",
  position: [24.8607, 67.0011] as [number, number],
};

export default function SatelliteAnalysisPage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function searchPlaces(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({
        q: value,
        format: "jsonv2",
        limit: "5",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok)
        throw new Error(`Place search failed (${response.status})`);
      const nextResults = (await response.json()) as SearchResult[];
      setResults(nextResults);
      if (nextResults.length === 0) setSearchError(t("satellite.noPlaces"));
    } catch (error) {
      setResults([]);
      setSearchError(
        error instanceof Error ? error.message : t("satellite.searchFailed"),
      );
    } finally {
      setIsSearching(false);
    }
  }

  function selectPlace(result: SearchResult) {
    setLocation({
      label: result.display_name,
      position: [Number(result.lat), Number(result.lon)],
    });
    setResults([]);
    setQuery(result.display_name);
  }

  function openGoogleMaps() {
    const [lat, lng] = location.position;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          <ScanSearch size={15} /> {t("satellite.adminTools")}
        </div>
        <h1 className="text-2xl font-bold text-text">{t("satellite.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          {t("satellite.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("satellite.chooseArea")}</CardTitle>
        </CardHeader>
        <form
          onSubmit={searchPlaces}
          className="relative flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor="place-search">{t("satellite.searchPlace")}</Label>
            <Input
              id="place-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("satellite.searchPlaceholder")}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={isSearching || !query.trim()}>
            <Search size={16} />{" "}
            {isSearching ? t("satellite.searching") : t("satellite.search")}
          </Button>
          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-[76px] z-20 overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:right-[112px]">
              {results.map((result) => (
                <button
                  key={`${result.lat}-${result.lon}`}
                  type="button"
                  onClick={() => selectPlace(result)}
                  className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left text-sm text-text last:border-b-0 hover:bg-bg"
                >
                  <MapPin size={16} className="mt-0.5 shrink-0 text-accent" />
                  <span>{result.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </form>
        {searchError && (
          <p className="mt-3 text-sm text-secondary">{searchError}</p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="overflow-hidden p-0">
          <SatelliteAnalysisMapClient
            position={location.position}
            label={location.label}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">
                {location.label}
              </div>
              <div className="mt-1 font-mono text-xs text-text-muted">
                {location.position[0].toFixed(5)},{" "}
                {location.position[1].toFixed(5)}
              </div>
            </div>
            <Button type="button" variant="secondary" onClick={openGoogleMaps}>
              <ExternalLink size={16} /> {t("satellite.openMaps")}
            </Button>
          </div>
        </Card>

        <SafeSpotAnalyzer position={location.position} />
      </div>
    </div>
  );
}
