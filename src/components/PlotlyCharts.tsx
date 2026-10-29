import React, { useState, useRef, useMemo } from "react";
import { Maximize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface SubplotData {
  title: string;
  data: { date: string; value: number }[];
  color: string;
  unit: string;
}

/**
 * 1. Dual Time Series Plot (used in Data Explorer)
 * Subplot 1: PM 2.5
 * Subplot 2: PM 10
 */
export const DualTimeSeriesPlot: React.FC<{
  city: string;
  pm25Data: { date: string; value: number }[];
  pm10Data: { date: string; value: number }[];
}> = ({ city, pm25Data, pm10Data }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [zoomRange, setZoomRange] = useState<[number, number]>([0, 1]);
  const containerRef = useRef<HTMLDivElement>(null);

  const n = pm25Data.length;
  const startIdx = Math.floor(zoomRange[0] * n);
  const endIdx = Math.max(startIdx + 10, Math.floor(zoomRange[1] * n));

  const visiblePm25 = useMemo(() => pm25Data.slice(startIdx, endIdx), [pm25Data, startIdx, endIdx]);
  const visiblePm10 = useMemo(() => pm10Data.slice(startIdx, endIdx), [pm10Data, startIdx, endIdx]);

  const max25 = Math.max(...visiblePm25.map((d) => d.value), 50);
  const min25 = Math.min(...visiblePm25.map((d) => d.value), 0);
  const max10 = Math.max(...visiblePm10.map((d) => d.value), 100);
  const min10 = Math.min(...visiblePm10.map((d) => d.value), 0);

  const width = 800;
  const height = 480;
  const plotWidth = 720;
  const plotHeight = 160;
  const margin = { left: 60, right: 20, top1: 50, top2: 260 };

  const getPath = (data: { date: string; value: number }[], minVal: number, maxVal: number, topOffset: number) => {
    if (data.length === 0) return "";
    const range = maxVal - minVal || 1;
    return data
      .map((d, i) => {
        const x = margin.left + (i / (data.length - 1)) * plotWidth;
        const y = topOffset + plotHeight - ((d.value - minVal) / range) * plotHeight;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relX = clientX - margin.left;
    if (relX >= 0 && relX <= plotWidth && visiblePm25.length > 0) {
      const idx = Math.min(
        visiblePm25.length - 1,
        Math.max(0, Math.round((relX / plotWidth) * (visiblePm25.length - 1)))
      );
      setHoverIndex(idx);
    } else {
      setHoverIndex(null);
    }
  };

  return (
    <div className="w-full bg-[#14141E] border border-[#2e3548] rounded-md p-3 relative font-mono text-xs shadow-inner">
      {/* Plot Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#222a3d] mb-1">
        <span className="text-sm font-semibold text-white">Historical PM Data — {city}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomRange([0, 1])}
            className="p-1 rounded bg-[#1f2638] text-gray-300 hover:text-white hover:bg-[#28324a]"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Subplot 1: PM 2.5 */}
          <text x={margin.left} y={margin.top1 - 10} fill="#00C9FF" fontSize="12" fontWeight="bold">
            PM 2.5 (µg/m³)
          </text>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = margin.top1 + plotHeight * (1 - pct);
            const val = min25 + pct * (max25 - min25);
            return (
              <g key={`g1-${i}`}>
                <line x1={margin.left} y1={y} x2={margin.left + plotWidth} y2={y} stroke="#1f2638" strokeDasharray="3 3" />
                <text x={margin.left - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}
          {/* PM 2.5 Line */}
          <path d={getPath(visiblePm25, min25, max25, margin.top1)} fill="none" stroke="#00C9FF" strokeWidth="1.5" />

          {/* Subplot 2: PM 10 */}
          <text x={margin.left} y={margin.top2 - 10} fill="#FF6B6B" fontSize="12" fontWeight="bold">
            PM 10 (µg/m³)
          </text>
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = margin.top2 + plotHeight * (1 - pct);
            const val = min10 + pct * (max10 - min10);
            return (
              <g key={`g2-${i}`}>
                <line x1={margin.left} y1={y} x2={margin.left + plotWidth} y2={y} stroke="#1f2638" strokeDasharray="3 3" />
                <text x={margin.left - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}
          {/* PM 10 Line */}
          <path d={getPath(visiblePm10, min10, max10, margin.top2)} fill="none" stroke="#FF6B6B" strokeWidth="1.5" />

          {/* X Axis dates */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const x = margin.left + pct * plotWidth;
            const idx = Math.min(visiblePm25.length - 1, Math.floor(pct * visiblePm25.length));
            const dateStr = visiblePm25[idx]?.date || "";
            return (
              <g key={`x-${i}`}>
                <line x1={x} y1={margin.top2 + plotHeight} x2={x} y2={margin.top2 + plotHeight + 6} stroke="#334155" />
                <text x={x} y={margin.top2 + plotHeight + 20} fill="#94a3b8" fontSize="10" textAnchor="middle">
                  {dateStr}
                </text>
              </g>
            );
          })}

          {/* Hover Crosshair & Dots */}
          {hoverIndex !== null && visiblePm25[hoverIndex] && (
            <g>
              {(() => {
                const x = margin.left + (hoverIndex / (visiblePm25.length - 1)) * plotWidth;
                const d25 = visiblePm25[hoverIndex];
                const d10 = visiblePm10[hoverIndex];
                const y1 = margin.top1 + plotHeight - ((d25.value - min25) / (max25 - min25 || 1)) * plotHeight;
                const y2 = margin.top2 + plotHeight - ((d10.value - min10) / (max10 - min10 || 1)) * plotHeight;

                return (
                  <>
                    <line x1={x} y1={margin.top1} x2={x} y2={margin.top2 + plotHeight} stroke="#64748b" strokeDasharray="2 2" />
                    <circle cx={x} cy={y1} r="4" fill="#00C9FF" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={x} cy={y2} r="4" fill="#FF6B6B" stroke="#fff" strokeWidth="1.5" />
                  </>
                );
              })()}
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoverIndex !== null && visiblePm25[hoverIndex] && (
          <div
            className="absolute top-2 right-2 bg-[#0B0F19]/95 border border-[#334155] rounded px-3 py-2 text-xs shadow-lg pointer-events-none"
            style={{ backdropFilter: "blur(4px)" }}
          >
            <div className="text-gray-400 mb-1">{visiblePm25[hoverIndex].date}</div>
            <div className="text-[#00C9FF] font-semibold">PM 2.5: {visiblePm25[hoverIndex].value} µg/m³</div>
            <div className="text-[#FF6B6B] font-semibold">PM 10: {visiblePm10[hoverIndex]?.value} µg/m³</div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 2. Forecast Plot (used in Train & Predict)
 * Displays Train (Raw), Denoised (EVDHM), Actual (Test), EVDHM-ARIMA (Test), and Forecast (+Nd)
 */
export const ForecastPlot: React.FC<{
  city: string;
  pollutant: string;
  trainDates: string[];
  trainRaw: number[];
  denoisedTrain: number[];
  testDates: string[];
  actualTest: number[];
  hybridTest: number[];
  futureDates: string[];
  future: number[];
}> = ({
  city,
  pollutant,
  trainDates,
  trainRaw,
  denoisedTrain,
  testDates,
  actualTest,
  hybridTest,
  futureDates,
  future,
}) => {
  const [visibleSeries, setVisibleSeries] = useState({
    trainRaw: true,
    denoisedTrain: true,
    actualTest: true,
    hybridTest: true,
    future: true,
  });

  const [hoverData, setHoverData] = useState<{
    date: string;
    values: { name: string; val: number; color: string }[];
  } | null>(null);

  // Combine full chronological timeline
  const fullTimeline = useMemo(() => {
    const list: {
      date: string;
      trainRaw?: number;
      denoisedTrain?: number;
      actualTest?: number;
      hybridTest?: number;
      future?: number;
    }[] = [];

    for (let i = 0; i < trainDates.length; i++) {
      list.push({
        date: trainDates[i],
        trainRaw: trainRaw[i],
        denoisedTrain: denoisedTrain[i],
      });
    }
    for (let i = 0; i < testDates.length; i++) {
      list.push({
        date: testDates[i],
        actualTest: actualTest[i],
        hybridTest: hybridTest[i],
      });
    }
    for (let i = 0; i < futureDates.length; i++) {
      list.push({
        date: futureDates[i],
        future: future[i],
      });
    }
    return list;
  }, [trainDates, trainRaw, denoisedTrain, testDates, actualTest, hybridTest, futureDates, future]);

  const allValues = [
    ...trainRaw,
    ...denoisedTrain,
    ...actualTest,
    ...hybridTest,
    ...future,
  ].filter((v) => !isNaN(v));

  const minVal = Math.max(0, Math.min(...allValues) - 5);
  const maxVal = Math.max(...allValues) + 10;

  const width = 800;
  const height = 440;
  const plotWidth = 720;
  const plotHeight = 330;
  const margin = { left: 60, right: 20, top: 50 };

  const getLinePath = (getter: (d: (typeof fullTimeline)[0]) => number | undefined) => {
    let path = "";
    let started = false;
    fullTimeline.forEach((item, i) => {
      const v = getter(item);
      if (v !== undefined) {
        const x = margin.left + (i / (fullTimeline.length - 1)) * plotWidth;
        const y = margin.top + plotHeight - ((v - minVal) / (maxVal - minVal || 1)) * plotHeight;
        if (!started) {
          path += `M ${x.toFixed(1)},${y.toFixed(1)}`;
          started = true;
        } else {
          path += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
        }
      } else {
        started = false;
      }
    });
    return path;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) * (width / rect.width) - margin.left;
    if (relX >= 0 && relX <= plotWidth && fullTimeline.length > 0) {
      const idx = Math.min(
        fullTimeline.length - 1,
        Math.max(0, Math.round((relX / plotWidth) * (fullTimeline.length - 1)))
      );
      const item = fullTimeline[idx];
      const vals: { name: string; val: number; color: string }[] = [];
      if (item.trainRaw !== undefined && visibleSeries.trainRaw)
        vals.push({ name: "Train (Raw)", val: item.trainRaw, color: "#aaaaaa" });
      if (item.denoisedTrain !== undefined && visibleSeries.denoisedTrain)
        vals.push({ name: "Denoised (EVDHM)", val: item.denoisedTrain, color: "#00C9FF" });
      if (item.actualTest !== undefined && visibleSeries.actualTest)
        vals.push({ name: "Actual (Test)", val: item.actualTest, color: "#FFFFFF" });
      if (item.hybridTest !== undefined && visibleSeries.hybridTest)
        vals.push({ name: "EVDHM-ARIMA (Test)", val: item.hybridTest, color: "#FFD700" });
      if (item.future !== undefined && visibleSeries.future)
        vals.push({ name: "Forecast", val: item.future, color: "#FF6B6B" });

      setHoverData({ date: item.date, values: vals });
    } else {
      setHoverData(null);
    }
  };

  return (
    <div className="w-full bg-[#14141E] border border-[#2e3548] rounded-md p-3 relative font-mono text-xs shadow-inner">
      <div className="flex flex-wrap items-center justify-between pb-2 border-b border-[#222a3d] mb-2 gap-2">
        <span className="text-sm font-semibold text-white">
          EVDHM-ARIMA Forecast — {city} {pollutant}
        </span>

        {/* Legend toggles */}
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleSeries.trainRaw}
              onChange={() => setVisibleSeries((s) => ({ ...s, trainRaw: !s.trainRaw }))}
              className="accent-gray-400"
            />
            <span className="w-2.5 h-0.5 bg-[#aaaaaa] inline-block"></span>
            <span className="text-[#aaaaaa]">Train (Raw)</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleSeries.denoisedTrain}
              onChange={() => setVisibleSeries((s) => ({ ...s, denoisedTrain: !s.denoisedTrain }))}
              className="accent-cyan-400"
            />
            <span className="w-2.5 h-0.5 bg-[#00C9FF] inline-block border-t border-dashed border-[#00C9FF]"></span>
            <span className="text-[#00C9FF]">Denoised (EVDHM)</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleSeries.actualTest}
              onChange={() => setVisibleSeries((s) => ({ ...s, actualTest: !s.actualTest }))}
              className="accent-white"
            />
            <span className="w-2.5 h-0.5 bg-white inline-block"></span>
            <span className="text-white">Actual (Test)</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleSeries.hybridTest}
              onChange={() => setVisibleSeries((s) => ({ ...s, hybridTest: !s.hybridTest }))}
              className="accent-yellow-400"
            />
            <span className="w-2.5 h-0.5 bg-[#FFD700] inline-block"></span>
            <span className="text-[#FFD700]">EVDHM-ARIMA (Test)</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleSeries.future}
              onChange={() => setVisibleSeries((s) => ({ ...s, future: !s.future }))}
              className="accent-rose-500"
            />
            <span className="w-2.5 h-0.5 bg-[#FF6B6B] inline-block"></span>
            <span className="text-[#FF6B6B]">Forecast (+{future.length}d)</span>
          </label>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverData(null)}
        >
          {/* Y Axis Grid & Labels */}
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((pct, i) => {
            const y = margin.top + plotHeight * (1 - pct);
            const val = minVal + pct * (maxVal - minVal);
            return (
              <g key={`y-${i}`}>
                <line x1={margin.left} y1={y} x2={margin.left + plotWidth} y2={y} stroke="#1f2638" strokeDasharray="3 3" />
                <text x={margin.left - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Test Split boundary vertical line */}
          {(() => {
            const splitRatio = trainDates.length / fullTimeline.length;
            const x = margin.left + splitRatio * plotWidth;
            return (
              <g>
                <line x1={x} y1={margin.top} x2={x} y2={margin.top + plotHeight} stroke="#475569" strokeDasharray="4 4" />
                <text x={x - 4} y={margin.top + 12} fill="#94a3b8" fontSize="9" textAnchor="end">
                  Train Split (80%)
                </text>
                <text x={x + 4} y={margin.top + 12} fill="#94a3b8" fontSize="9" textAnchor="start">
                  Test Split (20%)
                </text>
              </g>
            );
          })()}

          {/* Lines */}
          {visibleSeries.trainRaw && (
            <path
              d={getLinePath((d) => d.trainRaw)}
              fill="none"
              stroke="#aaaaaa"
              strokeWidth="1.1"
              opacity="0.8"
            />
          )}

          {visibleSeries.denoisedTrain && (
            <path
              d={getLinePath((d) => d.denoisedTrain)}
              fill="none"
              stroke="#00C9FF"
              strokeWidth="1.6"
              strokeDasharray="3 3"
            />
          )}

          {visibleSeries.actualTest && (
            <path
              d={getLinePath((d) => d.actualTest)}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.8"
            />
          )}

          {visibleSeries.hybridTest && (
            <path
              d={getLinePath((d) => d.hybridTest)}
              fill="none"
              stroke="#FFD700"
              strokeWidth="2.2"
            />
          )}

          {visibleSeries.future && (
            <g>
              <path
                d={getLinePath((d) => d.future)}
                fill="none"
                stroke="#FF6B6B"
                strokeWidth="2.5"
              />
              {/* Markers for future forecast */}
              {future.map((val, idx) => {
                const globalIdx = trainDates.length + testDates.length + idx;
                const x = margin.left + (globalIdx / (fullTimeline.length - 1)) * plotWidth;
                const y = margin.top + plotHeight - ((val - minVal) / (maxVal - minVal || 1)) * plotHeight;
                return <circle key={idx} cx={x} cy={y} r="3" fill="#FF6B6B" stroke="#ffffff" strokeWidth="1" />;
              })}
            </g>
          )}

          {/* X Axis date labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const x = margin.left + pct * plotWidth;
            const idx = Math.min(fullTimeline.length - 1, Math.floor(pct * fullTimeline.length));
            const dateStr = fullTimeline[idx]?.date || "";
            return (
              <g key={`x-${i}`}>
                <line x1={x} y1={margin.top + plotHeight} x2={x} y2={margin.top + plotHeight + 6} stroke="#334155" />
                <text x={x} y={margin.top + plotHeight + 18} fill="#94a3b8" fontSize="10" textAnchor="middle">
                  {dateStr}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover info tooltip */}
        {hoverData && (
          <div
            className="absolute top-2 right-2 bg-[#0B0F19]/95 border border-[#334155] rounded px-3 py-2 text-xs shadow-lg pointer-events-none"
            style={{ backdropFilter: "blur(4px)" }}
          >
            <div className="text-gray-400 mb-1 font-semibold">{hoverData.date}</div>
            {hoverData.values.map((v, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <span style={{ color: v.color }}>{v.name}:</span>
                <span className="font-bold text-white">{v.val.toFixed(2)} µg/m³</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 3. Model Comparison Bar Plot (MAE and RMSE)
 */
export const ModelComparisonBarPlot: React.FC<{
  city: string;
  pollutant: string;
  hybridMAE: number;
  hybridRMSE: number;
  pureMAE: number;
  pureRMSE: number;
  rfMAE: number;
  rfRMSE: number;
}> = ({ city, pollutant, hybridMAE, hybridRMSE, pureMAE, pureRMSE, rfMAE, rfRMSE }) => {
  const models = [
    { name: "EVDHM-ARIMA", mae: hybridMAE, rmse: hybridRMSE, color: "#FFD700" },
    { name: "Pure ARIMA", mae: pureMAE, rmse: pureRMSE, color: "#00C9FF" },
    { name: "Random Forest", mae: rfMAE, rmse: rfRMSE, color: "#FF6B6B" },
  ];

  const maxError = Math.max(...models.flatMap((m) => [m.mae, m.rmse])) * 1.25 || 10;

  const width = 600;
  const height = 300;
  const margin = { left: 60, right: 30, top: 40, bottom: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  return (
    <div className="w-full bg-[#14141E] border border-[#2e3548] rounded-md p-3 font-mono text-xs shadow-inner">
      <div className="flex items-center justify-between pb-2 border-b border-[#222a3d] mb-2">
        <span className="text-sm font-semibold text-white">
          Model Comparison — {city} {pollutant}
        </span>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-gray-300 inline-block rounded-xs"></span>
            <span className="text-gray-300">MAE (Solid)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-gray-500/50 inline-block rounded-xs border border-gray-400"></span>
            <span className="text-gray-400">RMSE (Translucent)</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
        {/* Y Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = margin.top + plotHeight * (1 - pct);
          const val = pct * maxError;
          return (
            <g key={i}>
              <line x1={margin.left} y1={y} x2={margin.left + plotWidth} y2={y} stroke="#1f2638" strokeDasharray="3 3" />
              <text x={margin.left - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Grouped Bars */}
        {models.map((m, idx) => {
          const groupWidth = plotWidth / models.length;
          const groupX = margin.left + idx * groupWidth;
          const barWidth = 36;
          const gap = 12;

          const maeHeight = (m.mae / maxError) * plotHeight;
          const rmseHeight = (m.rmse / maxError) * plotHeight;

          const maeX = groupX + groupWidth / 2 - barWidth - gap / 2;
          const rmseX = groupX + groupWidth / 2 + gap / 2;

          return (
            <g key={idx}>
              {/* MAE Bar */}
              <rect
                x={maeX}
                y={margin.top + plotHeight - maeHeight}
                width={barWidth}
                height={maeHeight}
                fill={m.color}
                opacity="0.95"
                rx="2"
              />
              <text
                x={maeX + barWidth / 2}
                y={margin.top + plotHeight - maeHeight - 5}
                fill={m.color}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {m.mae.toFixed(2)}
              </text>

              {/* RMSE Bar */}
              <rect
                x={rmseX}
                y={margin.top + plotHeight - rmseHeight}
                width={barWidth}
                height={rmseHeight}
                fill={m.color}
                opacity="0.55"
                rx="2"
              />
              <text
                x={rmseX + barWidth / 2}
                y={margin.top + plotHeight - rmseHeight - 5}
                fill="#cbd5e1"
                fontSize="10"
                textAnchor="middle"
              >
                {m.rmse.toFixed(2)}
              </text>

              {/* Model Label */}
              <text
                x={groupX + groupWidth / 2}
                y={margin.top + plotHeight + 22}
                fill="#e2e8f0"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                {m.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * 4. Multi-city Visualizations:
 * - Average PM Levels by City with WHO Limits
 * - Seasonal Monthly Trend
 * - PM Distribution Box Plots
 */
export const CityComparisonVisualizations: React.FC<{
  citySummaries: { city: string; tier: string; avgPm25: number; avgPm10: number }[];
  monthlyData: { month: number; Kolkata: number; Siliguri: number; Haldia: number }[];
  cityDataMap: Record<string, { pm25: number[]; pm10: number[] }>;
}> = ({ citySummaries, monthlyData, cityDataMap }) => {
  const cityColors: Record<string, string> = {
    Kolkata: "#FFD700",
    Siliguri: "#00C9FF",
    Haldia: "#FF6B6B",
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Average PM Levels by City */}
        <div className="bg-[#14141E] border border-[#2e3548] rounded-md p-3 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between pb-2 border-b border-[#222a3d] mb-2">
            <span className="text-sm font-semibold text-white">Average PM Levels by City</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-[#FFD700]">
                <span className="w-2.5 h-2.5 bg-[#FFD700] rounded-xs inline-block"></span> Avg PM 2.5
              </span>
              <span className="flex items-center gap-1 text-gray-300">
                <span className="w-2.5 h-2.5 bg-gray-400 opacity-60 rounded-xs inline-block"></span> Avg PM 10
              </span>
            </div>
          </div>

          <svg viewBox="0 0 450 260" className="w-full h-auto select-none">
            {/* WHO Guideline Lines */}
            {/* Max is ~140 */}
            {(() => {
              const maxVal = 140;
              const y60 = 30 + 180 * (1 - 60 / maxVal);
              const y100 = 30 + 180 * (1 - 100 / maxVal);
              return (
                <>
                  <line x1="50" y1={y60} x2="420" y2={y60} stroke="#FFFFFF" strokeDasharray="4 4" strokeWidth="1" />
                  <text x="55" y={y60 - 4} fill="#FFFFFF" fontSize="9">
                    WHO PM2.5 limit (60)
                  </text>

                  <line x1="50" y1={y100} x2="420" y2={y100} stroke="#FF9800" strokeDasharray="4 4" strokeWidth="1" />
                  <text x="55" y={y100 - 4} fill="#FF9800" fontSize="9">
                    WHO PM10 limit (100)
                  </text>
                </>
              );
            })()}

            {/* Grid */}
            {[0, 40, 80, 120].map((val) => {
              const y = 30 + 180 * (1 - val / 140);
              return (
                <g key={val}>
                  <line x1="50" y1={y} x2="420" y2={y} stroke="#1f2638" strokeDasharray="2 2" />
                  <text x="44" y={y + 3} fill="#64748b" fontSize="9" textAnchor="end">
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {citySummaries.map((item, idx) => {
              const groupX = 80 + idx * 115;
              const barW = 28;
              const h25 = (item.avgPm25 / 140) * 180;
              const h10 = (item.avgPm10 / 140) * 180;
              const c = cityColors[item.city] || "#FFD700";

              return (
                <g key={idx}>
                  {/* PM 2.5 */}
                  <rect x={groupX} y={210 - h25} width={barW} height={h25} fill={c} rx="2" />
                  <text x={groupX + barW / 2} y={205 - h25} fill={c} fontSize="10" fontWeight="bold" textAnchor="middle">
                    {item.avgPm25}
                  </text>

                  {/* PM 10 */}
                  <rect x={groupX + barW + 6} y={210 - h10} width={barW} height={h10} fill={c} opacity="0.55" rx="2" />
                  <text x={groupX + barW + 6 + barW / 2} y={205 - h10} fill="#e2e8f0" fontSize="10" textAnchor="middle">
                    {item.avgPm10}
                  </text>

                  {/* City Label */}
                  <text x={groupX + barW + 3} y="230" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
                    {item.city}
                  </text>
                  <text x={groupX + barW + 3} y="244" fill="#94a3b8" fontSize="9" textAnchor="middle">
                    ({item.tier})
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Chart 2: Seasonal Trend (Monthly Mean PM 2.5) */}
        <div className="bg-[#14141E] border border-[#2e3548] rounded-md p-3 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between pb-2 border-b border-[#222a3d] mb-2">
            <span className="text-sm font-semibold text-white">Monthly Mean PM 2.5 — Seasonal Pattern</span>
            <div className="flex items-center gap-3 text-[11px]">
              {["Kolkata", "Siliguri", "Haldia"].map((city) => (
                <span key={city} className="flex items-center gap-1" style={{ color: cityColors[city] }}>
                  <span className="w-2.5 h-1 inline-block" style={{ backgroundColor: cityColors[city] }}></span>
                  {city}
                </span>
              ))}
            </div>
          </div>

          <svg viewBox="0 0 450 260" className="w-full h-auto select-none">
            {/* Grid */}
            {[20, 40, 60, 80, 100].map((val) => {
              const y = 30 + 170 * (1 - (val - 20) / 80);
              return (
                <g key={val}>
                  <line x1="45" y1={y} x2="430" y2={y} stroke="#1f2638" strokeDasharray="2 2" />
                  <text x="40" y={y + 3} fill="#64748b" fontSize="9" textAnchor="end">
                    {val}
                  </text>
                </g>
              );
            })}

            {/* City lines */}
            {(["Kolkata", "Siliguri", "Haldia"] as const).map((city) => {
              const color = cityColors[city];
              const points = monthlyData.map((d, i) => {
                const x = 55 + (i / 11) * 365;
                const val = d[city];
                const y = 30 + 170 * (1 - (val - 20) / 80);
                return { x, y, val };
              });

              const pathStr = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

              return (
                <g key={city}>
                  <path d={pathStr} fill="none" stroke={color} strokeWidth="2" />
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="#fff" strokeWidth="0.8" />
                  ))}
                </g>
              );
            })}

            {/* Month labels */}
            {monthNames.map((m, i) => {
              const x = 55 + (i / 11) * 365;
              return (
                <text key={m} x={x} y="225" fill="#94a3b8" fontSize="9" textAnchor="middle">
                  {m}
                </text>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Chart 3: PM Distribution by City & Pollutant Box Plots */}
      <div className="bg-[#14141E] border border-[#2e3548] rounded-md p-3 font-mono text-xs shadow-inner">
        <div className="flex items-center justify-between pb-2 border-b border-[#222a3d] mb-2">
          <span className="text-sm font-semibold text-white">PM Distribution by City and Pollutant</span>
          <div className="text-gray-400 text-[11px]">Box plot: min, Q1, median (line), mean (dot), Q3, max</div>
        </div>

        <svg viewBox="0 0 700 240" className="w-full h-auto select-none">
          {/* Y-axis grid: 0 to 200 */}
          {[0, 50, 100, 150, 200].map((val) => {
            const y = 20 + 170 * (1 - val / 200);
            return (
              <g key={val}>
                <line x1="50" y1={y} x2="680" y2={y} stroke="#1f2638" strokeDasharray="3 3" />
                <text x="44" y={y + 3} fill="#64748b" fontSize="9" textAnchor="end">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Box items */}
          {(() => {
            const boxes: { label: string; city: string; values: number[]; color: string; isPm10: boolean }[] = [];
            ["Kolkata", "Siliguri", "Haldia"].forEach((city) => {
              if (cityDataMap[city]) {
                boxes.push({
                  label: `${city} PM2.5`,
                  city,
                  values: cityDataMap[city].pm25,
                  color: cityColors[city],
                  isPm10: false,
                });
                boxes.push({
                  label: `${city} PM10`,
                  city,
                  values: cityDataMap[city].pm10,
                  color: cityColors[city],
                  isPm10: true,
                });
              }
            });

            return boxes.map((box, idx) => {
              const sorted = [...box.values].sort((a, b) => a - b);
              const q1 = sorted[Math.floor(sorted.length * 0.25)] || 0;
              const median = sorted[Math.floor(sorted.length * 0.5)] || 0;
              const q3 = sorted[Math.floor(sorted.length * 0.75)] || 0;
              const min = sorted[0] || 0;
              const max = sorted[sorted.length - 1] || 0;
              const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;

              const x = 75 + idx * 100;
              const bw = 34;

              const getY = (v: number) => 20 + 170 * (1 - Math.min(200, Math.max(0, v)) / 200);

              const yMax = getY(max);
              const yQ3 = getY(q3);
              const yMed = getY(median);
              const yMean = getY(mean);
              const yQ1 = getY(q1);
              const yMin = getY(min);

              return (
                <g key={idx}>
                  {/* Whiskers */}
                  <line x1={x + bw / 2} y1={yMin} x2={x + bw / 2} y2={yQ1} stroke="#64748b" strokeWidth="1.2" />
                  <line x1={x + bw / 2} y1={yQ3} x2={x + bw / 2} y2={yMax} stroke="#64748b" strokeWidth="1.2" />
                  <line x1={x + bw / 4} y1={yMin} x2={x + (3 * bw) / 4} y2={yMin} stroke="#64748b" strokeWidth="1.2" />
                  <line x1={x + bw / 4} y1={yMax} x2={x + (3 * bw) / 4} y2={yMax} stroke="#64748b" strokeWidth="1.2" />

                  {/* Box */}
                  <rect
                    x={x}
                    y={yQ3}
                    width={bw}
                    height={Math.max(2, yQ1 - yQ3)}
                    fill={box.color}
                    fillOpacity={box.isPm10 ? "0.4" : "0.85"}
                    stroke={box.color}
                    strokeWidth="1.2"
                    rx="1"
                  />

                  {/* Median line */}
                  <line x1={x} y1={yMed} x2={x + bw} y2={yMed} stroke="#ffffff" strokeWidth="2" />

                  {/* Mean marker dot */}
                  <circle cx={x + bw / 2} cy={yMean} r="2.5" fill="#FFFFFF" stroke="#000" strokeWidth="0.5" />

                  {/* Label */}
                  <text x={x + bw / 2} y="210" fill="#cbd5e1" fontSize="9.5" textAnchor="middle">
                    {box.label}
                  </text>
                </g>
              );
            });
          })()}
        </svg>
      </div>
    </div>
  );
};
