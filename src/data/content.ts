/**
 * Exact Text Content from app.py
 */

export const ABOUT_MD = `
# 🌫️ Sensing of Particulate Matter (PM 2.5 and PM 10) in the Air of Tier 1, Tier 2, and Tier 3 Cities in India Using EVDHM-ARIMA Hybrid Model

---

## 📖 Abstract

Air pollution has become one of the most critical environmental challenges facing India's rapidly urbanising landscape. Particulate Matter — specifically **PM 2.5** (fine particles ≤ 2.5 µm) and **PM 10** (coarse particles ≤ 10 µm) — poses severe risks to public health, causing respiratory and cardiovascular diseases. Accurate forecasting of PM concentrations is essential for timely advisories and policy interventions.

This research proposes a **hybrid EVDHM-ARIMA model** that combines:
- **Eigenvalue Decomposition of Hankel Matrix (EVDHM)** — a signal-processing technique that denoises the raw time-series by extracting dominant structural components via eigenvalue analysis, and
- **ARIMA (AutoRegressive Integrated Moving Average)** — a classical statistical model for univariate time-series forecasting applied on the denoised signal.

The model is evaluated across three representative Indian cities: **Kolkata (Tier-1)**, **Siliguri (Tier-2)**, and **Haldia (Tier-3)**, each exhibiting distinct pollution profiles driven by industrial, vehicular, and meteorological factors.

---

## 🏙️ Introduction

India is home to some of the world's most polluted cities. Rapid industrialisation, vehicle emissions, construction dust, crop burning, and seasonal weather patterns combine to produce dangerously elevated particulate levels. Air Quality Index (AQI) guidelines issued by CPCB classify PM 2.5 > 60 µg/m³ and PM 10 > 100 µg/m³ as *poor* quality.

Tier-1 megacities like **Kolkata** exhibit persistent high PM loads due to dense traffic and industrial activity. Tier-2 cities like **Siliguri**, situated near the foothills of the Himalayas, experience seasonal variations driven by biomass burning and dust storms. Tier-3 industrial towns like **Haldia** have localised industrial point sources (petrochemical complexes, fertiliser plants) that create sporadic but intense pollution episodes.

Traditional monitoring approaches rely on ground sensor networks that are expensive to deploy and maintain. Time-series forecasting models offer a cost-effective complement, enabling forward-looking predictions from historical observations.

---

## ⚙️ Proposed System — EVDHM-ARIMA Hybrid Model

### Step 1 — Eigenvalue Decomposition of Hankel Matrix (EVDHM)

Given a univariate time series **x = [x₁, x₂, …, xₙ]**:

1. Construct an **L × K Hankel matrix** H where L is the window length and K = N − L + 1.
2. Compute the covariance matrix **S = H · Hᵀ**.
3. Perform **eigen-decomposition** of S → eigenvalues λᵢ and eigenvectors uᵢ.
4. Select the top-*r* eigenvectors corresponding to the largest eigenvalues.
5. **Reconstruct** the denoised signal by projecting H onto the selected eigenvectors and diagonal-averaging.

This step suppresses noise and irregular spikes while preserving the underlying trend-seasonal structure.

### Step 2 — ARIMA Forecasting

The denoised series is fed into an **ARIMA(5,1,0)** model:
- **AR(5)**: Autoregressive term of order 5 captures short-term dependencies.
- **I(1)**: First-order differencing ensures stationarity.
- **MA(0)**: Moving average term omitted for parsimony.

The model is estimated on the training split (80%) and evaluated on the test split (20%).

### Benchmark Models
- **Pure ARIMA** (no denoising) — isolates the benefit of EVDHM preprocessing.
- **Random Forest Regressor** — non-linear ML baseline using lagged features.

---

## ✅ Advantages

| Feature | EVDHM-ARIMA | Pure ARIMA | Random Forest |
|---|---|---|---|
| Signal denoising | ✅ Yes | ❌ No | ❌ No |
| Handles non-stationarity | ✅ Yes | ✅ Yes | ✅ Yes |
| Interpretability | ✅ High | ✅ High | ⚠️ Medium |
| Forecast accuracy | ✅ Best | ⚠️ Moderate | ⚠️ Moderate |
| Computational cost | ⚠️ Medium | ✅ Low | ⚠️ Medium |

- **Noise robustness**: EVDHM separates signal from noise before forecasting, significantly reducing error propagation.
- **Structural preservation**: Eigenvalue-based reconstruction retains dominant periodicities (daily, seasonal).
- **Generalisability**: The hybrid framework is applicable to any pollutant time-series regardless of city tier.
- **Scalability**: Modular design allows plugging in alternative forecasting models (e.g., LSTM, Prophet).

---

## 📊 Conclusion

The proposed **EVDHM-ARIMA hybrid model** has demonstrated superior forecasting performance compared to both pure ARIMA and Random Forest baselines across all three city tiers and both pollutants.

> *"The proposed model has shown the best performance among all. The best parameter indicator was achieved for the Kolkata database for PM10. The least performance was observed for Haldia for PM10, attributable to the irregular industrial emission patterns of the petrochemical corridor. Overall, the hybrid EVDHM-ARIMA architecture offers a robust, scalable, and interpretable framework for real-time air quality forecasting across India's diverse urban landscape."*

The integration of eigenvalue-based signal decomposition with classical time-series modelling represents a promising direction for environmental sensing applications, with direct utility for public health advisory systems, smart city dashboards, and regulatory compliance monitoring.

---
> **Note:** This prototype demonstrates the hybrid EVDHM-ARIMA model proposed in the research paper.  
> Cities studied: Kolkata (Tier-1) · Siliguri (Tier-2) · Haldia (Tier-3)
`;

export const CONCLUSION_MD = `
## 📋 Results Summary & Conclusion

### Key Findings

The experiments were conducted across three cities representing India's urban hierarchy:

| City | Tier | PM 2.5 Base (µg/m³) | PM 10 Base (µg/m³) | EVDHM-ARIMA Performance |
|---|---|---|---|---|
| **Kolkata** | Tier-1 | ~65 | ~110 | ✅ **Best overall** |
| **Siliguri** | Tier-2 | ~45 | ~75 | ✅ Good |
| **Haldia** | Tier-3 | ~55 | ~95 | ⚠️ Least (PM10) |

### Conclusion Statement (from paper)

> *"The proposed model has shown the best performance among all. The best parameter indicator was achieved for the **Kolkata** database for **PM10**. The least performance was observed for **Haldia** for **PM10**, attributable to irregular industrial emission patterns. The hybrid EVDHM-ARIMA architecture consistently outperformed both Pure ARIMA and Random Forest baselines, validating that eigenvalue-based signal denoising is a valuable preprocessing step for urban air quality forecasting."*

### Why EVDHM-ARIMA Wins

1. **Denoising effect**: EVDHM removes sensor noise and outliers before forecasting — reducing MAE by 10–25% vs pure ARIMA.
2. **Structural extraction**: Dominant eigencomponents capture periodicity patterns invisible to raw ARIMA.
3. **Stability**: More consistent across different pollution regimes (industrial vs traffic-dominated).

### Recommendations

- Deploy real-time EVDHM-ARIMA pipelines in CPCB monitoring networks.
- Extend to PM 1.0 and gaseous pollutants (NOₓ, SO₂, O₃).
- Integrate meteorological covariates (temperature, humidity, wind speed) as exogenous variables.
- Explore deep learning extensions: EVDHM + Transformer or EVDHM + LSTM.

---
> **This prototype demonstrates the hybrid EVDHM-ARIMA model proposed in the research paper.**
`;

export const SIDEBAR_NOTE = `
> 🔬 **Research Prototype**  
> This app demonstrates the hybrid **EVDHM-ARIMA** model proposed in the research paper on PM sensing in Indian cities.  
>  
> Cities: **Kolkata** (Tier-1) · **Siliguri** (Tier-2) · **Haldia** (Tier-3)  
>  
> Data: Upload your own CSVs or use built-in synthetic data.
`;
