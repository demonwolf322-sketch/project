/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import Papa from "papaparse";
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Play,
  BarChart2,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

import {
  CityName,
  PMRecord,
  loadCityData,
  SYNTHETIC_DATA,
} from "./services/dataGenerator";
import {
  fullPipeline,
  PipelineResult,
} from "./services/algorithms";
import {
  ABOUT_MD,
  CONCLUSION_MD,
  SIDEBAR_NOTE,
} from "./data/content";
import { MarkdownView } from "./components/MarkdownView";
import {
  DualTimeSeriesPlot,
  ForecastPlot,
  ModelComparisonBarPlot,
  CityComparisonVisualizations,
} from "./components/PlotlyCharts";

export default function App() {
  // Active Tab: 0 = About, 1 = Data Explorer, 2 = Train & Predict, 3 = Results & Comparison, 4 = Visualizations
  const [activeTab, setActiveTab] = useState<number>(0);

  // Custom uploaded files store
  const [uploadedData, setUploadedData] = useState<Partial<Record<CityName, PMRecord[]>>>({});
  const [uploadedFileNames, setUploadedFileNames] = useState<Partial<Record<CityName, string>>>({});

  // ── Tab 2 State (Data Explorer) ──
  const [expCity, setExpCity] = useState<CityName>("Kolkata");
  const [expDataLoaded, setExpDataLoaded] = useState<boolean>(true);
  const [isExpLoading, setIsExpLoading] = useState<boolean>(false);

  // ── Tab 3 State (Train & Predict) ──
  const [predCity, setPredCity] = useState<CityName>("Kolkata");
  const [predPollutant, setPredPollutant] = useState<"PM 2.5" | "PM 10">("PM 2.5");
  const [forecastDays, setForecastDays] = useState<number>(14);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [pipelineDates, setPipelineDates] = useState<{
    trainDates: string[];
    testDates: string[];
    futureDates: string[];
  } | null>(null);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);

  // ── Tab 4 State (Batch Comparison) ──
  const [batchResults, setBatchResults] = useState<
    {
      city: CityName;
      tier: string;
      pollutant: string;
      evdhmMAE: number;
      evdhmRMSE: number;
      pureMAE: number;
      pureRMSE: number;
      rfMAE: number;
      rfRMSE: number;
    }[]
  >([]);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);

  // ── Tab 5 State (Visualizations) ──
  const [vizLoaded, setVizLoaded] = useState<boolean>(true);
  const [isVizLoading, setIsVizLoading] = useState<boolean>(false);

  // Initial computation for Tab 3 on mount so user sees immediate results like in the live prototype
  useEffect(() => {
    handleRunPrediction("Kolkata", "PM 2.5", 14);
  }, []);

  // ─────────────────────────────────────────────
  // FILE UPLOAD HANDLER
  // ─────────────────────────────────────────────
  const handleFileUpload = (city: CityName, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target?.result as string;
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[];
          const validRecords: PMRecord[] = [];

          for (const row of rows) {
            const date = row.date || row.Date;
            const pm25 = parseFloat(row.pm25 ?? row.PM25 ?? row["PM 2.5"]);
            const pm10 = parseFloat(row.pm10 ?? row.PM10 ?? row["PM 10"]);

            if (date && !isNaN(pm25) && !isNaN(pm10)) {
              validRecords.push({
                date: String(date).slice(0, 10),
                pm25: Math.round(pm25 * 100) / 100,
                pm10: Math.round(pm10 * 100) / 100,
              });
            }
          }

          if (validRecords.length > 0) {
            validRecords.sort((a, b) => a.date.localeCompare(b.date));
            setUploadedData((prev) => ({ ...prev, [city]: validRecords }));
            setUploadedFileNames((prev) => ({ ...prev, [city]: file.name }));
          } else {
            alert("CSV must contain columns: date, pm25, pm10");
          }
        },
      });
    };
    reader.readAsText(file);
  };

  const handleRemoveFile = (city: CityName) => {
    setUploadedData((prev) => {
      const copy = { ...prev };
      delete copy[city];
      return copy;
    });
    setUploadedFileNames((prev) => {
      const copy = { ...prev };
      delete copy[city];
      return copy;
    });
  };

  // Sample CSV generator for user convenience
  const handleDownloadSample = (city: CityName) => {
    const data = SYNTHETIC_DATA[city];
    const csvContent =
      "date,pm25,pm10\n" +
      data
        .slice(0, 100)
        .map((r) => `${r.date},${r.pm25},${r.pm10}`)
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${city.toLowerCase()}_sample.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─────────────────────────────────────────────
  // TAB 2: EXPLORE DATA
  // ─────────────────────────────────────────────
  const currentCityData = useMemo(() => {
    return loadCityData(expCity, uploadedData);
  }, [expCity, uploadedData]);

  const descriptiveStats = useMemo(() => {
    const pm25Vals = currentCityData.map((d) => d.pm25);
    const pm10Vals = currentCityData.map((d) => d.pm10);

    const calc = (vals: number[]) => {
      if (vals.length === 0) return { count: 0, mean: 0, std: 0, min: 0, p25: 0, p50: 0, p75: 0, max: 0 };
      const n = vals.length;
      const sorted = [...vals].sort((a, b) => a - b);
      const mean = vals.reduce((a, b) => a + b, 0) / n;
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1 || 1);
      const std = Math.sqrt(variance);

      return {
        count: n,
        mean: Math.round(mean * 100) / 100,
        std: Math.round(std * 100) / 100,
        min: sorted[0],
        p25: sorted[Math.floor(n * 0.25)],
        p50: sorted[Math.floor(n * 0.5)],
        p75: sorted[Math.floor(n * 0.75)],
        max: sorted[n - 1],
      };
    };

    const s25 = calc(pm25Vals);
    const s10 = calc(pm10Vals);

    return [
      { name: "count", pm25: s25.count.toFixed(2), pm10: s10.count.toFixed(2) },
      { name: "mean", pm25: s25.mean.toFixed(2), pm10: s10.mean.toFixed(2) },
      { name: "std", pm25: s25.std.toFixed(2), pm10: s10.std.toFixed(2) },
      { name: "min", pm25: s25.min.toFixed(2), pm10: s10.min.toFixed(2) },
      { name: "25%", pm25: s25.p25.toFixed(2), pm10: s10.p25.toFixed(2) },
      { name: "50%", pm25: s25.p50.toFixed(2), pm10: s10.p50.toFixed(2) },
      { name: "75%", pm25: s25.p75.toFixed(2), pm10: s10.p75.toFixed(2) },
      { name: "max", pm25: s25.max.toFixed(2), pm10: s10.max.toFixed(2) },
    ];
  }, [currentCityData]);

  // ─────────────────────────────────────────────
  // TAB 3: RUN PREDICTION
  // ─────────────────────────────────────────────
  const handleRunPrediction = (city = predCity, pollutant = predPollutant, days = forecastDays) => {
    setIsPredicting(true);
    setTimeout(() => {
      const data = loadCityData(city, uploadedData);
      const series = data.map((d) => (pollutant === "PM 2.5" ? d.pm25 : d.pm10));
      const dates = data.map((d) => d.date);

      const res = fullPipeline(series, days);

      const split = res.splitIdx;
      const trainDates = dates.slice(0, split);
      const testDates = dates.slice(split);

      const lastDate = new Date(dates[dates.length - 1] || "2023-12-31");
      const futureDates: string[] = [];
      for (let i = 1; i <= days; i++) {
        const next = new Date(lastDate.getTime() + i * 86400000);
        futureDates.push(next.toISOString().slice(0, 10));
      }

      setPipelineResult(res);
      setPipelineDates({ trainDates, testDates, futureDates });
      setIsPredicting(false);
    }, 150);
  };

  const handleDownloadForecastCSV = () => {
    if (!pipelineResult || !pipelineDates) return;
    const rows = [["date", "forecast", "city", "pollutant"]];
    pipelineDates.futureDates.forEach((d, i) => {
      rows.push([d, pipelineResult.future[i]?.toFixed(3) || "0", predCity, predPollutant]);
    });
    const csvStr = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `forecast_${predCity.toLowerCase()}_${predPollutant.replace(/\s+/g, "")}.csv`;
    link.click();
  };

  // ─────────────────────────────────────────────
  // TAB 4: BATCH COMPARISON
  // ─────────────────────────────────────────────
  const handleRunBatchCompare = () => {
    setIsBatchRunning(true);
    setTimeout(() => {
      const rows: typeof batchResults = [];
      const cities: CityName[] = ["Kolkata", "Siliguri", "Haldia"];
      const tiers: Record<CityName, string> = {
        Kolkata: "Tier-1",
        Siliguri: "Tier-2",
        Haldia: "Tier-3",
      };

      for (const city of cities) {
        const df = loadCityData(city, uploadedData);
        for (const [colKey, label] of [
          ["pm25", "PM 2.5"],
          ["pm10", "PM 10"],
        ] as const) {
          const series = df.map((d) => (colKey === "pm25" ? d.pm25 : d.pm10));
          const res = fullPipeline(series, 7);
          rows.push({
            city,
            tier: tiers[city],
            pollutant: label,
            evdhmMAE: res.hybridMetrics.MAE,
            evdhmRMSE: res.hybridMetrics.RMSE,
            pureMAE: res.pureMetrics.MAE,
            pureRMSE: res.pureMetrics.RMSE,
            rfMAE: res.rfMetrics.MAE,
            rfRMSE: res.rfMetrics.RMSE,
          });
        }
      }
      setBatchResults(rows);
      setIsBatchRunning(false);
    }, 200);
  };

  // ─────────────────────────────────────────────
  // TAB 5: VISUALIZATIONS DATA
  // ─────────────────────────────────────────────
  const vizData = useMemo(() => {
    const cities: CityName[] = ["Kolkata", "Siliguri", "Haldia"];
    const tiers: Record<CityName, string> = {
      Kolkata: "Tier-1",
      Siliguri: "Tier-2",
      Haldia: "Tier-3",
    };

    const summaries = cities.map((city) => {
      const df = loadCityData(city, uploadedData);
      const avgPm25 =
        Math.round((df.reduce((a, b) => a + b.pm25, 0) / (df.length || 1)) * 10) / 10;
      const avgPm10 =
        Math.round((df.reduce((a, b) => a + b.pm10, 0) / (df.length || 1)) * 10) / 10;
      return {
        city,
        tier: tiers[city],
        avgPm25,
        avgPm10,
      };
    });

    // Monthly mean PM 2.5
    const monthlyAverages: { month: number; Kolkata: number; Siliguri: number; Haldia: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const row = { month: m + 1, Kolkata: 0, Siliguri: 0, Haldia: 0 };
      cities.forEach((city) => {
        const df = loadCityData(city, uploadedData);
        const monthRecords = df.filter((d) => {
          const monthNum = parseInt(d.date.slice(5, 7), 10) - 1;
          return monthNum === m;
        });
        const mean25 =
          monthRecords.reduce((a, b) => a + b.pm25, 0) / (monthRecords.length || 1);
        row[city] = Math.round(mean25 * 10) / 10;
      });
      monthlyAverages.push(row);
    }

    // City arrays for box plot
    const cityDataMap: Record<string, { pm25: number[]; pm10: number[] }> = {};
    cities.forEach((city) => {
      const df = loadCityData(city, uploadedData);
      cityDataMap[city] = {
        pm25: df.map((d) => d.pm25),
        pm10: df.map((d) => d.pm10),
      };
    });

    return { summaries, monthlyAverages, cityDataMap };
  }, [uploadedData]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#e2e8f0] font-mono selection:bg-[#FFD700] selection:text-black">
      {/* ── GRADIO CONTAINER ── */}
      <div className="max-w-[1280px] mx-auto px-3 sm:px-5 py-5">
        {/* Header */}
        <header className="text-center py-5 border-b border-[#1f2638] mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#FFD700] tracking-tight flex items-center justify-center gap-2">
            <span>🌫️</span> EVDHM-ARIMA Hybrid Model
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1.5 max-w-2xl mx-auto">
            Sensing PM 2.5 &amp; PM 10 in Tier 1, 2 &amp; 3 Cities of India (Kolkata, Siliguri, Haldia)
          </p>
        </header>

        {/* Gradio Row: Sidebar + Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ────────────────────────────────────────────────────────── */}
          {/* LEFT SIDEBAR (Scale 1 / ~260-300px) */}
          {/* ────────────────────────────────────────────────────────── */}
          <aside className="lg:col-span-3 space-y-4">
            {/* Research Note Callout */}
            <div className="bg-[#141824] border border-[#262f44] rounded-lg p-3.5 text-xs text-gray-300 leading-relaxed shadow-sm">
              <div className="flex items-center gap-1.5 text-[#FFD700] font-semibold mb-1.5">
                <Sparkles className="w-4 h-4 text-[#FFD700]" />
                <span>Research Prototype</span>
              </div>
              <p className="mb-2">
                This app demonstrates the hybrid <strong className="text-white">EVDHM-ARIMA</strong> model proposed in the research paper on particulate matter sensing in Indian cities.
              </p>
              <div className="text-[11px] text-gray-400 border-t border-[#1f2638] pt-2 mt-2 space-y-1">
                <div>
                  <strong className="text-gray-300">Cities:</strong> Kolkata (Tier-1) · Siliguri (Tier-2) · Haldia (Tier-3)
                </div>
                <div>
                  <strong className="text-gray-300">Data:</strong> Upload custom CSVs or use built-in synthetic dataset.
                </div>
              </div>
            </div>

            {/* Upload Data Card */}
            <div className="bg-[#141824] border border-[#262f44] rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#00C9FF]" />
                  <span>📂 Upload Data (optional)</span>
                </h3>
              </div>
              <p className="text-[11px] text-gray-400 italic">
                *CSV must have columns: <code className="text-[#00C9FF]">date</code>, <code className="text-[#00C9FF]">pm25</code>, <code className="text-[#00C9FF]">pm10</code>*
              </p>

              {(["Kolkata", "Siliguri", "Haldia"] as const).map((city) => {
                const isCustom = !!uploadedData[city];
                const fileName = uploadedFileNames[city];
                return (
                  <div key={city} className="bg-[#0e121c] border border-[#202738] rounded p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-white">{city.toLowerCase()}.csv</span>
                      <button
                        onClick={() => handleDownloadSample(city)}
                        className="text-[10px] text-gray-400 hover:text-[#00C9FF] flex items-center gap-0.5"
                        title="Download sample template"
                      >
                        <Download className="w-2.5 h-2.5" /> Sample
                      </button>
                    </div>

                    {isCustom ? (
                      <div className="flex items-center justify-between bg-[#192233] border border-[#2e3b55] rounded px-2 py-1 text-[11px]">
                        <span className="truncate max-w-[140px] text-[#00C9FF] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {fileName} ({uploadedData[city]?.length} rows)
                        </span>
                        <button
                          onClick={() => handleRemoveFile(city)}
                          className="text-red-400 hover:text-red-300 ml-1"
                          title="Clear upload"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-1.5 border border-dashed border-[#2d374d] hover:border-[#00C9FF] rounded py-1.5 px-2 cursor-pointer text-[11px] text-gray-400 hover:text-white transition-colors bg-[#131722]/50">
                        <Upload className="w-3 h-3 text-gray-400" />
                        <span>Choose {city.toLowerCase()}.csv</span>
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => handleFileUpload(city, e)}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ────────────────────────────────────────────────────────── */}
          {/* MAIN CONTENT AREA (Scale 4 / lg:col-span-9) */}
          {/* ────────────────────────────────────────────────────────── */}
          <main className="lg:col-span-9">
            {/* Gradio Tab Navigation */}
            <div className="flex flex-wrap items-center gap-1 border-b border-[#262f44] pb-1.5 mb-5 overflow-x-auto">
              {[
                { id: 0, label: "🏠 About" },
                { id: 1, label: "🔍 Data Explorer" },
                { id: 2, label: "🤖 Train & Predict" },
                { id: 3, label: "📋 Results & Comparison" },
                { id: 4, label: "📈 Visualizations" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-t text-xs font-semibold font-mono transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-[#181d2a] text-[#FFD700] border-t-2 border-[#FFD700] border-x border-[#262f44]"
                      : "text-gray-400 hover:text-gray-200 hover:bg-[#141824]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB PANELS */}
            <div className="bg-[#121622] border border-[#202738] rounded-lg p-4 sm:p-6 shadow-md">
              {/* ──────────────── TAB 1: ABOUT ──────────────── */}
              {activeTab === 0 && (
                <div className="prose prose-invert max-w-none">
                  <MarkdownView content={ABOUT_MD} />
                </div>
              )}

              {/* ──────────────── TAB 2: DATA EXPLORER ──────────────── */}
              {activeTab === 1 && (
                <div className="space-y-5">
                  <h3 className="text-base font-bold text-white border-b border-[#202738] pb-2">
                    Explore Historical PM Data
                  </h3>

                  {/* Controls Row */}
                  <div className="flex flex-wrap items-end gap-3 bg-[#161b28] p-3 rounded-md border border-[#222a3d]">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Select City
                      </label>
                      <select
                        value={expCity}
                        onChange={(e) => setExpCity(e.target.value as CityName)}
                        className="w-full bg-[#0d111a] border border-[#2d374d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFD700]"
                      >
                        <option value="Kolkata">Kolkata (Tier-1)</option>
                        <option value="Siliguri">Siliguri (Tier-2)</option>
                        <option value="Haldia">Haldia (Tier-3)</option>
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        setIsExpLoading(true);
                        setTimeout(() => {
                          setExpDataLoaded(true);
                          setIsExpLoading(false);
                        }, 120);
                      }}
                      className="px-4 py-1.5 bg-[#FFD700] hover:bg-[#f6c800] text-black font-bold text-xs rounded transition flex items-center gap-1.5 shadow"
                    >
                      {isExpLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "📊 Load & Explore"}
                    </button>
                  </div>

                  {/* Dual Subplot Chart */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-300">PM Time Series</div>
                    <DualTimeSeriesPlot
                      city={expCity}
                      pm25Data={currentCityData.map((d) => ({ date: d.date, value: d.pm25 }))}
                      pm10Data={currentCityData.map((d) => ({ date: d.date, value: d.pm10 }))}
                    />
                  </div>

                  {/* Descriptive Statistics Table */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-300">Descriptive Statistics</div>
                    <div className="overflow-x-auto border border-[#202738] rounded-md bg-[#131722]">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead>
                          <tr className="border-b border-[#262f44] bg-[#1a2030] text-[#FFD700]">
                            <th className="py-2 px-3 font-semibold">Statistic</th>
                            <th className="py-2 px-3 font-semibold text-[#00C9FF]">PM 2.5</th>
                            <th className="py-2 px-3 font-semibold text-[#FF6B6B]">PM 10</th>
                          </tr>
                        </thead>
                        <tbody>
                          {descriptiveStats.map((stat, i) => (
                            <tr
                              key={i}
                              className={`border-b border-[#1b2233] hover:bg-[#1a2030]/60 ${
                                i % 2 === 0 ? "bg-[#131722]" : "bg-[#161b28]"
                              }`}
                            >
                              <td className="py-2 px-3 font-semibold text-gray-300">{stat.name}</td>
                              <td className="py-2 px-3 text-[#d1d5db]">{stat.pm25}</td>
                              <td className="py-2 px-3 text-[#d1d5db]">{stat.pm10}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────── TAB 3: TRAIN & PREDICT ──────────────── */}
              {activeTab === 2 && (
                <div className="space-y-5">
                  <h3 className="text-base font-bold text-white border-b border-[#202738] pb-2">
                    Run EVDHM-ARIMA Hybrid Prediction
                  </h3>

                  {/* Input Parameter Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#161b28] p-3.5 rounded-md border border-[#222a3d]">
                    {/* City Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">City</label>
                      <select
                        value={predCity}
                        onChange={(e) => setPredCity(e.target.value as CityName)}
                        className="w-full bg-[#0d111a] border border-[#2d374d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFD700]"
                      >
                        <option value="Kolkata">Kolkata</option>
                        <option value="Siliguri">Siliguri</option>
                        <option value="Haldia">Haldia</option>
                      </select>
                    </div>

                    {/* Pollutant Radio */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Pollutant</label>
                      <div className="flex items-center gap-4 py-1">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer text-gray-200">
                          <input
                            type="radio"
                            name="pollutant"
                            value="PM 2.5"
                            checked={predPollutant === "PM 2.5"}
                            onChange={() => setPredPollutant("PM 2.5")}
                            className="accent-[#FFD700]"
                          />
                          <span>PM 2.5</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer text-gray-200">
                          <input
                            type="radio"
                            name="pollutant"
                            value="PM 10"
                            checked={predPollutant === "PM 10"}
                            onChange={() => setPredPollutant("PM 10")}
                            className="accent-[#FFD700]"
                          />
                          <span>PM 10</span>
                        </label>
                      </div>
                    </div>

                    {/* Forecast Slider */}
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                        <span>Forecast Days Ahead</span>
                        <span className="text-[#FFD700]">{forecastDays} days</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value={forecastDays}
                        onChange={(e) => setForecastDays(parseInt(e.target.value, 10))}
                        className="w-full accent-[#FFD700] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Primary Predict Action Button */}
                  <button
                    onClick={() => handleRunPrediction()}
                    disabled={isPredicting}
                    className="w-full py-2.5 bg-[#FFD700] hover:bg-[#f6c800] active:scale-[0.99] text-black font-bold text-sm rounded shadow-lg transition flex items-center justify-center gap-2"
                  >
                    {isPredicting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        <span>Computing EVDHM &amp; ARIMA models...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀 Run EVDHM-ARIMA Prediction</span>
                      </>
                    )}
                  </button>

                  {/* Results: Forecast Chart */}
                  {pipelineResult && pipelineDates && (
                    <div className="space-y-4 pt-1">
                      <div>
                        <div className="text-xs font-semibold text-gray-300 mb-1">Forecast Chart</div>
                        <ForecastPlot
                          city={predCity}
                          pollutant={predPollutant}
                          trainDates={pipelineDates.trainDates}
                          trainRaw={pipelineResult.trainRaw}
                          denoisedTrain={pipelineResult.denoisedTrain}
                          testDates={pipelineDates.testDates}
                          actualTest={pipelineResult.testRaw}
                          hybridTest={pipelineResult.hybridTest}
                          futureDates={pipelineDates.futureDates}
                          future={pipelineResult.future}
                        />
                      </div>

                      {/* Model Metrics Table */}
                      <div>
                        <div className="text-xs font-semibold text-gray-300 mb-1">
                          Model Metrics (Test Set)
                        </div>
                        <div className="overflow-x-auto border border-[#202738] rounded-md bg-[#131722]">
                          <table className="w-full text-left text-xs font-mono border-collapse">
                            <thead>
                              <tr className="border-b border-[#262f44] bg-[#1a2030] text-[#FFD700]">
                                <th className="py-2.5 px-3 font-semibold">Model</th>
                                <th className="py-2.5 px-3 font-semibold">MAE (µg/m³)</th>
                                <th className="py-2.5 px-3 font-semibold">RMSE (µg/m³)</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-[#1b2233] bg-[#161f30]">
                                <td className="py-2 px-3 font-bold text-[#FFD700] flex items-center gap-1.5">
                                  <span>🏆</span> EVDHM-ARIMA
                                </td>
                                <td className="py-2 px-3 font-semibold text-emerald-400">
                                  {pipelineResult.hybridMetrics.MAE.toFixed(4)}
                                </td>
                                <td className="py-2 px-3 font-semibold text-emerald-400">
                                  {pipelineResult.hybridMetrics.RMSE.toFixed(4)}
                                </td>
                              </tr>
                              <tr className="border-b border-[#1b2233] bg-[#131722]">
                                <td className="py-2 px-3 font-medium text-[#00C9FF]">Pure ARIMA</td>
                                <td className="py-2 px-3 text-gray-300">
                                  {pipelineResult.pureMetrics.MAE.toFixed(4)}
                                </td>
                                <td className="py-2 px-3 text-gray-300">
                                  {pipelineResult.pureMetrics.RMSE.toFixed(4)}
                                </td>
                              </tr>
                              <tr className="bg-[#161b28]">
                                <td className="py-2 px-3 font-medium text-[#FF6B6B]">Random Forest</td>
                                <td className="py-2 px-3 text-gray-300">
                                  {pipelineResult.rfMetrics.MAE.toFixed(4)}
                                </td>
                                <td className="py-2 px-3 text-gray-300">
                                  {pipelineResult.rfMetrics.RMSE.toFixed(4)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Model Comparison Bar Chart */}
                      <div>
                        <div className="text-xs font-semibold text-gray-300 mb-1">Model Comparison</div>
                        <ModelComparisonBarPlot
                          city={predCity}
                          pollutant={predPollutant}
                          hybridMAE={pipelineResult.hybridMetrics.MAE}
                          hybridRMSE={pipelineResult.hybridMetrics.RMSE}
                          pureMAE={pipelineResult.pureMetrics.MAE}
                          pureRMSE={pipelineResult.pureMetrics.RMSE}
                          rfMAE={pipelineResult.rfMetrics.MAE}
                          rfRMSE={pipelineResult.rfMetrics.RMSE}
                        />
                      </div>

                      {/* Download Forecast CSV */}
                      <div className="bg-[#151926] border border-[#232b3f] rounded-md p-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-white">Export Predictions</div>
                          <div className="text-[11px] text-gray-400">
                            Download +{forecastDays}-day forward forecast results as CSV
                          </div>
                        </div>
                        <button
                          onClick={handleDownloadForecastCSV}
                          className="px-4 py-2 bg-[#202738] hover:bg-[#2b354d] text-[#00C9FF] border border-[#34415c] text-xs font-semibold rounded flex items-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>⬇️ Download Forecast CSV</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ──────────────── TAB 4: RESULTS & COMPARISON ──────────────── */}
              {activeTab === 3 && (
                <div className="space-y-6">
                  {/* Markdown conclusions */}
                  <MarkdownView content={CONCLUSION_MD} />

                  <hr className="border-[#222a3d] my-6" />

                  {/* Batch Comparison Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>🏆</span> Run Batch Comparison (All Cities × Both Pollutants)
                    </h3>
                    <button
                      onClick={handleRunBatchCompare}
                      disabled={isBatchRunning}
                      className="px-5 py-2 bg-[#FFD700] hover:bg-[#f6c800] text-black font-bold text-xs rounded shadow transition flex items-center gap-2"
                    >
                      {isBatchRunning ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Running full matrix across 3 cities &amp; 2 pollutants...</span>
                        </>
                      ) : (
                        <span>📊 Generate Full Comparison Table</span>
                      )}
                    </button>

                    {batchResults.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-300">Full Results Matrix</div>
                        <div className="overflow-x-auto border border-[#202738] rounded-md bg-[#131722]">
                          <table className="w-full text-left text-xs font-mono border-collapse">
                            <thead>
                              <tr className="border-b border-[#262f44] bg-[#1a2030] text-[#FFD700]">
                                <th className="py-2.5 px-3">City</th>
                                <th className="py-2.5 px-3">Tier</th>
                                <th className="py-2.5 px-3">Pollutant</th>
                                <th className="py-2.5 px-3 text-[#FFD700]">EVDHM-ARIMA MAE</th>
                                <th className="py-2.5 px-3 text-[#FFD700]">EVDHM-ARIMA RMSE</th>
                                <th className="py-2.5 px-3 text-[#00C9FF]">Pure ARIMA MAE</th>
                                <th className="py-2.5 px-3 text-[#00C9FF]">Pure ARIMA RMSE</th>
                                <th className="py-2.5 px-3 text-[#FF6B6B]">RF MAE</th>
                                <th className="py-2.5 px-3 text-[#FF6B6B]">RF RMSE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchResults.map((r, i) => (
                                <tr
                                  key={i}
                                  className={`border-b border-[#1b2233] hover:bg-[#1a2030]/60 ${
                                    i % 2 === 0 ? "bg-[#131722]" : "bg-[#161b28]"
                                  }`}
                                >
                                  <td className="py-2 px-3 font-semibold text-white">{r.city}</td>
                                  <td className="py-2 px-3 text-gray-400">{r.tier}</td>
                                  <td className="py-2 px-3 text-gray-200">{r.pollutant}</td>
                                  <td className="py-2 px-3 font-bold text-emerald-400">{r.evdhmMAE.toFixed(4)}</td>
                                  <td className="py-2 px-3 font-bold text-emerald-400">{r.evdhmRMSE.toFixed(4)}</td>
                                  <td className="py-2 px-3 text-gray-300">{r.pureMAE.toFixed(4)}</td>
                                  <td className="py-2 px-3 text-gray-300">{r.pureRMSE.toFixed(4)}</td>
                                  <td className="py-2 px-3 text-gray-400">{r.rfMAE.toFixed(4)}</td>
                                  <td className="py-2 px-3 text-gray-400">{r.rfRMSE.toFixed(4)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ──────────────── TAB 5: VISUALIZATIONS ──────────────── */}
              {activeTab === 4 && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202738] pb-3">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Multi-City PM Analysis &amp; Visual Comparison
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Comparative trends, monthly seasonal cycles, and distribution across Kolkata, Siliguri, and Haldia.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setIsVizLoading(true);
                        setTimeout(() => {
                          setVizLoaded(true);
                          setIsVizLoading(false);
                        }, 150);
                      }}
                      className="px-4 py-2 bg-[#FFD700] hover:bg-[#f6c800] text-black font-bold text-xs rounded transition flex items-center gap-1.5 shadow"
                    >
                      {isVizLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "🎨 Generate Visualizations"}
                    </button>
                  </div>

                  {/* Multi-city charts */}
                  <CityComparisonVisualizations
                    citySummaries={vizData.summaries}
                    monthlyData={vizData.monthlyAverages}
                    cityDataMap={vizData.cityDataMap}
                  />

                  {/* City Summary Table */}
                  <div className="space-y-1 pt-2">
                    <div className="text-xs font-semibold text-gray-300">City Summary</div>
                    <div className="overflow-x-auto border border-[#202738] rounded-md bg-[#131722]">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead>
                          <tr className="border-b border-[#262f44] bg-[#1a2030] text-[#FFD700]">
                            <th className="py-2 px-3 font-semibold">City</th>
                            <th className="py-2 px-3 font-semibold">Tier</th>
                            <th className="py-2 px-3 font-semibold text-[#00C9FF]">Avg PM 2.5</th>
                            <th className="py-2 px-3 font-semibold text-[#FF6B6B]">Avg PM 10</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vizData.summaries.map((s, i) => (
                            <tr
                              key={i}
                              className={`border-b border-[#1b2233] hover:bg-[#1a2030]/60 ${
                                i % 2 === 0 ? "bg-[#131722]" : "bg-[#161b28]"
                              }`}
                            >
                              <td className="py-2 px-3 font-semibold text-white">{s.city}</td>
                              <td className="py-2 px-3 text-gray-400">{s.tier}</td>
                              <td className="py-2 px-3 text-emerald-400 font-semibold">{s.avgPm25} µg/m³</td>
                              <td className="py-2 px-3 text-[#e2e8f0] font-semibold">{s.avgPm10} µg/m³</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-[11px] font-mono py-8 border-t border-[#1a2030] mt-10">
          EVDHM-ARIMA Prototype &nbsp;|&nbsp; Kolkata · Siliguri · Haldia &nbsp;|&nbsp; Built with Gradio + Plotly + statsmodels + scikit-learn
        </footer>
      </div>
    </div>
  );
}
