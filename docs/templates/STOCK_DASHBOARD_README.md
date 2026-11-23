# Stock & Revenue Analysis Dashboard

> **Interactive Financial Analytics & Revenue Trend Visualization in Python**  
> An exploratory financial analytics dashboard analyzing historical stock trajectories and quarterly revenue trends for major technology and retail equities (Tesla, Amazon, AMD, GameStop) using Yahoo Finance APIs and BeautifulSoup web scraping.

---

## 1. Overview

This project provides an end-to-end financial data pipeline and visualization dashboard designed to compare equity price momentum against historical corporate revenue growth:
- **Market Data Extraction**: Automated ingestion of historical daily stock prices, trading volumes, stock splits, and dividend yields via the `yfinance` API.
- **Web Scraping Pipeline**: HTML parsing of corporate earnings disclosures using `BeautifulSoup` to extract quarterly and annual revenue figures from public financial statements.
- **Interactive Visualizations**: Dynamic, responsive time-series charts generated with `Plotly` and `Matplotlib` enabling zoom, pan, and hover inspections across custom historical date ranges.

---

## 2. Methodology & Analytical Workflow

```
1. Market Data Extraction ──▶ yfinance API (TSLA, AMZN, AMD, GME)
2. Revenue Extraction     ──▶ BeautifulSoup HTML Parsing (Quarterly Tables)
3. Data Cleaning          ──▶ Pandas DataFrames (Currency normalization, null handling)
4. Interactive Dashboard  ──▶ Plotly Graph Objects & Matplotlib Overlays
```

### Key Analytical Inquiries
- **Revenue vs. Valuation Divergence**: Comparing quarterly revenue trends against equity price trajectories during volatile earnings cycles.
- **Volume Correlation**: Identifying abnormal volume spikes coinciding with quarterly earnings releases or macro announcements.

---

## 3. Technology Stack

- **Language**: Python 3.10+
- **Data Manipulation**: `pandas`, `numpy`
- **Data Acquisition**: `yfinance`, `requests`, `beautifulsoup4`
- **Visualization**: `plotly`, `matplotlib`
- **Environment**: Jupyter Notebook

---

## 4. Getting Started

### Prerequisites

```bash
pip install pandas numpy yfinance requests beautifulsoup4 plotly matplotlib jupyter
```

### Running the Notebook

```bash
# Clone the repository
git clone https://github.com/Lokeshcodex-rbg/stock-analysis-dashboard.git
cd stock-analysis-dashboard

# Launch Jupyter Notebook
jupyter notebook stock_analysis_dashboard.ipynb
```

Execute cells sequentially to download fresh market quotes, scrape revenue tables, and render the interactive Plotly comparison dashboard.
