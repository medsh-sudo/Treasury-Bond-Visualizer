// Treasury Bond Visualizer - Data Scraper Version
let bondsData = [];
let filteredData = [];
let currentSort = { field: 'maturityDate', direction: 'asc' };

// Chart instances
let yieldDistributionChart = null;
let riskFreeRateChart = null;

// Configuration for TSETMC table
const TSETMC_CONFIG = {
    "UpdateSpeed": 1000,
    "ColorChangeSpeed": 7000,
    "ColorChangeEnable": 1,
    "ViewMode": 0,
    "Market": 0,
    "BasketNo": -1,
    "FilterNo": -1,
    "SectorNo": "",
    "sortField": "tno",
    "sortDirection": -1,
    "ActiveTemplate": 2,
    "Baskets": [],
    "Filters": [],
    "GroupBySector": 1,
    "LightBackground": 1,
    "BigNumberSymbol": 0,
    "ShowHousingFacilities": 0,
    "ShowSaham": 0,
    "ShowPayeFarabourse": 0,
    "ShowHaghTaghaddom": 0,
    "ShowOraghMosharekat": 1,
    "ShowEkhtiarForoush": 0,
    "ShowAti": 0,
    "ShowSandoogh": 0,
    "ShowKala": 0,
    "AutoScroll": 0,
    "LoadClientType": 0,
    "LoadInstStat": 0,
    "LoadInstHistory": 0,
    "CustomTemplate": {
        "colNo": 10,
        "fontSize": 12,
        "rowHeight": 20,
        "cols": [],
        "all": "",
        "rowStyle": "",
        "row": ""
    }
};

// Parse HTML table data from TSETMC
function parseTSETMCTable(htmlData) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlData, 'text/html');
    const rows = doc.querySelectorAll('div[id]');
    
    const bonds = [];
    
    rows.forEach(row => {
        // Skip section separators
        if (row.classList.contains('secSep')) return;
        
        const cells = row.querySelectorAll('div[style*="width"]');
        if (cells.length < 20) return; // Skip incomplete rows
        
        try {
            // Extract data from cells based on the provided HTML structure
            const symbol = cells[0]?.textContent?.trim() || '';
            const name = cells[1]?.textContent?.trim() || '';
            const volume = parseFloat(cells[3]?.textContent?.replace(/,/g, '') || '0');
            const lastPrice = parseFloat(cells[6]?.textContent?.replace(/,/g, '') || '0');
            const change = parseFloat(cells[8]?.textContent?.replace(/,/g, '') || '0');
            const changePercent = parseFloat(cells[9]?.textContent?.replace('%', '') || '0');
            
            // Extract maturity date from name (assuming format like "اسناد خزانه-م1-س.قوا03-060615")
            let maturityDate = null;
            const dateMatch = name.match(/(\d{2})(\d{2})(\d{2})$/);
            if (dateMatch) {
                const year = 1400 + parseInt(dateMatch[1]); // Convert to Persian year
                const month = parseInt(dateMatch[2]);
                const day = parseInt(dateMatch[3]);
                maturityDate = new Date(year, month - 1, day);
            }
            
            // Calculate days to maturity
            const daysToMaturity = maturityDate ? 
                Math.ceil((maturityDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
            
            // Determine if expired
            const isExpired = daysToMaturity !== null && daysToMaturity < 0;
            
            bonds.push({
                symbol: symbol,
                name: name,
                volume: volume,
                lastPrice: lastPrice,
                change: change,
                changePercent: changePercent,
                maturityDate: maturityDate,
                daysToMaturity: daysToMaturity,
                isExpired: isExpired,
                sector: getSectorFromName(name)
            });
        } catch (error) {
            console.error('Error parsing row:', error);
        }
    });
    
    return bonds;
}

// Extract sector from bond name
function getSectorFromName(name) {
    if (name.includes('اسناد خزانه') || name.includes('اخزا')) {
        return 'اسناد خزانه';
    } else if (name.includes('مرابحه عام دولت') || name.includes('اراد')) {
        return 'مرابحه عام دولت';
    } else if (name.includes('صكوك اجاره') || name.includes('صكوك مرابحه')) {
        return 'صكوك';
    } else {
        return 'سایر';
    }
}

// Utility functions for UI state management
function showLoading(show) {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
    
    // Update status
    if (show) {
        updateStatus('loading', 'در حال دریافت اطلاعات...');
    } else {
        updateStatus('success', 'اطلاعات با موفقیت دریافت شد');
    }
}

function showError(message) {
    updateStatus('error', message);
    console.error('Application error:', message);
}

// Fetch data from TSETMC website
async function fetchBondsData() {
    try {
        showLoading(true);
        // Fetch MarketWatchPlus data from the server proxy
        const response = await fetch('/api/tsetmc-data');
        if (!response.ok) throw new Error('خطا در دریافت داده از سرور');
        const rawText = await response.text();
        bondsData = parseTSETMCData(rawText);
        applyFilters();
        updateCharts();
        updateStats();
        showLoading(false);
    } catch (error) {
        console.error('Error fetching bonds data:', error);
        showLoading(false);
        showError('خطا در دریافت اطلاعات اوراق');
    }
}

// Parse MarketWatchPlus.aspx data
function parseTSETMCData(rawText) {
    console.log('Parsing TSETMC MarketWatchPlus data...');
    console.log('RAW DATA (first 500 chars):', rawText.slice(0, 500)); // Debug log
    
    // The MarketWatchPlus data is structured in sections separated by @@ and @
    // The relevant data for instruments seems to be in the second section, separated by @
    // and individual instruments are separated by ;
    const sections = rawText.split('@@');
    if (sections.length < 2) {
        console.error('Invalid TSETMC MarketWatchPlus data format: Missing @@ separator');
        return [];
    }

    const instrumentSections = sections[1].split('@');
    if (instrumentSections.length < 2) {
        console.error('Invalid TSETMC MarketWatchPlus data format: Missing @ separator in the second section');
        return [];
    }

    // The actual instrument data is in the second part of the second section
    const instrumentData = instrumentSections[1].split(';');
    const bonds = [];
    
    for (const instrumentStr of instrumentData) {
        
        // Try to extract maturity date from name (e.g. ...-YYMMDD)
        let maturityDate = null;
        const dateMatch = name.match(/(\d{2})(\d{2})(\d{2})$/);
        if (dateMatch) {
            const year = 1400 + parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]);
            const day = parseInt(dateMatch[3]);
            maturityDate = new Date(year, month - 1, day);
        }
        
        // Parse fields from the instrument string
        const fields = instrumentStr.split(',');
        console.log('INSTRUMENT FIELDS:', fields); // Debug log each instrument

        if (fields.length < 15) { // Adjusted minimum length based on observed data
             console.log('Skipping incomplete instrument data:', instrumentStr);
             continue;
        }

        try {
            // Based on manual observation of the data format in the commit v.2
            // and comparing with the new raw data, the fields seem to be in a different order.
            // We need to identify the correct indices for each piece of information.
            // This is a best effort based on limited samples and may need adjustment.

            const symbol = fields[0]?.trim() || ''; // Assuming the first field is the symbol
            const name = fields[1]?.trim() || '';   // Assuming the second field is the name

             // Let's try to find the last price and volume based on common positions in similar data feeds
             // This is highly speculative and might need refinement based on more data samples
            const lastPrice = parseFloat(fields[5]?.replace(/,/g, '') || '0'); // Speculative index
            const volume = parseFloat(fields[2]?.replace(/,/g, '') || '0');    // Speculative index
            const change = parseFloat(fields[6]?.replace(/,/g, '') || '0');     // Speculative index
            const changePercent = parseFloat(fields[7]?.replace(/%/g, '') || '0'); // Speculative index

             // Extract maturity date from name if possible
             let maturityDate = null;
             const dateMatch = name.match(/(\d{2})(\d{2})(\d{2})$/); // Example: ...-YYMMDD
             if (dateMatch) {
                 const year = 1400 + parseInt(dateMatch[1]);
                 const month = parseInt(dateMatch[2]);
                 const day = parseInt(dateMatch[3]);
                 maturityDate = new Date(year, month - 1, day);
             }

        }
        
        const daysToMaturity = maturityDate ? 
            Math.ceil((maturityDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
        const isExpired = daysToMaturity !== null && daysToMaturity < 0;
        
        // Calculate yield (simple discount bond yield)
        const yieldValue = lastPrice > 0 ? ((1000000 - lastPrice) / lastPrice * 100).toFixed(2) : '0.00';
        
        bonds.push({
            symbol,
            name,
            volume,
            lastPrice,
            maturityDate,
            daysToMaturity,
            isExpired,
            yield: yieldValue,
            sector: getSectorFromName(name)
        });
    }
    
    console.log('PARSED BONDS:', bonds.length); // Debug log
    return bonds;
}

// Apply filters and sorting to bonds data
function applyFilters() {
    let filtered = [...bondsData];
    
    // Apply search filter
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(bond => 
            bond.name.toLowerCase().includes(searchTerm) ||
            bond.symbol.toLowerCase().includes(searchTerm) ||
            bond.sector.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply sorting
    const sortBy = sortSelect.value;
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'yield-desc':
                return parseFloat(((1000000 - b.lastPrice) / b.lastPrice * 100).toFixed(2)) - 
                       parseFloat(((1000000 - a.lastPrice) / a.lastPrice * 100).toFixed(2));
            case 'yield-asc':
                return parseFloat(((1000000 - a.lastPrice) / a.lastPrice * 100).toFixed(2)) - 
                       parseFloat(((1000000 - b.lastPrice) / b.lastPrice * 100).toFixed(2));
            case 'price-desc':
                return b.lastPrice - a.lastPrice;
            case 'price-asc':
                return a.lastPrice - b.lastPrice;
            case 'volume-desc':
                return b.volume - a.volume;
            case 'volume-asc':
                return a.volume - b.volume;
            case 'maturity-asc':
                if (!a.maturityDate && !b.maturityDate) return 0;
                if (!a.maturityDate) return 1;
                if (!b.maturityDate) return -1;
                return a.maturityDate - b.maturityDate;
            case 'maturity-desc':
                if (!a.maturityDate && !b.maturityDate) return 0;
                if (!a.maturityDate) return 1;
                if (!b.maturityDate) return -1;
                return b.maturityDate - a.maturityDate;
            case 'days-asc':
                if (a.daysToMaturity === null && b.daysToMaturity === null) return 0;
                if (a.daysToMaturity === null) return 1;
                if (b.daysToMaturity === null) return -1;
                return a.daysToMaturity - b.daysToMaturity;
            case 'days-desc':
                if (a.daysToMaturity === null && b.daysToMaturity === null) return 0;
                if (a.daysToMaturity === null) return 1;
                if (b.daysToMaturity === null) return -1;
                return b.daysToMaturity - a.daysToMaturity;
            default:
                return 0;
        }
    });
    
    filteredData = filtered;
    
    // Update the table with filtered data
    renderBondsTable();
}

// Update charts with current data
function updateCharts() {
    if (filteredData.length === 0) {
        console.log('No data to update charts');
        return;
    }
    
    // Create charts if they don't exist
    if (typeof Chart !== 'undefined') {
        createCharts();
    } else {
        console.log('Chart.js not available, skipping chart updates');
    }
}

// Update statistics with current data
function updateStats() {
    if (filteredData.length === 0) {
        console.log('No data to update stats');
        return;
    }
    
    // Calculate yields for all bonds
    const yields = filteredData.map(bond => {
        return bond.lastPrice > 0 ? parseFloat(((1000000 - bond.lastPrice) / bond.lastPrice * 100).toFixed(2)) : 0;
    }).filter(yield => yield > 0);
    
    if (yields.length === 0) {
        console.log('No valid yields to calculate stats');
        return;
    }
    
    const avgYieldValue = yields.reduce((sum, yield) => sum + yield, 0) / yields.length;
    const maxYieldValue = Math.max(...yields);
    const minYieldValue = Math.min(...yields);
    
    console.log('Stats:', {
        total: filteredData.length,
        avgYield: avgYieldValue,
        maxYield: maxYieldValue,
        minYield: minYieldValue
    });
    
    // Update dashboard elements
    if (totalBonds) totalBonds.textContent = filteredData.length.toLocaleString('fa-IR');
    if (avgYield) avgYield.textContent = avgYieldValue.toFixed(2) + '%';
    if (maxYield) maxYield.textContent = maxYieldValue.toFixed(2) + '%';
    if (minYield) minYield.textContent = minYieldValue.toFixed(2) + '%';
}

// DOM Elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const refreshBtn = document.getElementById('refresh-btn');
const totalBonds = document.getElementById('total-bonds');
const avgYield = document.getElementById('avg-yield');
const maxYield = document.getElementById('max-yield');
const minYield = document.getElementById('min-yield');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const bondsTableBody = document.getElementById('bonds-table-body');
const calculateBtn = document.getElementById('calculate-btn');
const calculationResult = document.getElementById('calculation-result');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    fetchBondsData();
}

function setupEventListeners() {
    refreshBtn.addEventListener('click', fetchBondsData);
    searchInput.addEventListener('input', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
    calculateBtn.addEventListener('click', calculateYield);
}

// Removed old processBondsData function - using parseTSETMCData instead

// Removed unused ISIN parsing functions - using direct date parsing from bond names instead

function calculateYieldFromPrice(price, faceValue) {
    if (!price || !faceValue) return 0;
    
    const priceNum = parseFloat(price);
    const faceValueNum = parseFloat(faceValue);
    
    if (priceNum <= 0 || faceValueNum <= 0) return 0;
    
    // Simple yield calculation: (Face Value - Price) / Price * 100
    return ((faceValueNum - priceNum) / priceNum * 100).toFixed(2);
}

function getSampleData() {
    const today = new Date();
    const sampleMaturities = [
        { year: 1405, month: 6, day: 6, daysOffset: 300 },
        { year: 1404, month: 12, day: 5, daysOffset: -50 },
        { year: 1404, month: 7, day: 7, daysOffset: 150 },
        { year: 1404, month: 6, day: 9, daysOffset: 120 },
        { year: 1404, month: 6, day: 6, daysOffset: 90 },
        { year: 1404, month: 10, day: 10, daysOffset: 200 },
        { year: 1404, month: 4, day: 7, daysOffset: 60 }
    ];
    
    return sampleMaturities.map((maturity, index) => {
        const maturityDate = new Date(today.getTime() + (maturity.daysOffset * 24 * 60 * 60 * 1000));
        const daysRemaining = Math.ceil((maturityDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        const isExpired = daysRemaining < 0;
        
        return {
            name: [
                'اسناد خزانه-م1-س.قوا03-060615',
                'اسنادخزانه-م1بودجه02-050325',
                'مرابحه عام دولت226-ش.خ070414',
                'اسنادخزانه-م2بودجه02-050923',
                'مرابحه عام دولت227-ش.خ060921',
                'اسناد خزانه-م13بودجه02-051021',
                'اسناد خزانه-م11بودجه02-050720'
            ][index],
            code: [
                'اخزا301',
                'اخزا201',
                'اراد226',
                'اخزا202',
                'اراد227',
                'اخزا213',
                'اخزا211'
            ][index],
            price: [538930, 784870, 815000, 674260, 851100, 659000, 710300][index],
            volume: [167518, 104390, 19315000, 51729, 10380000, 10726, 322781][index],
            yield: [85.68, 27.42, 22.70, 48.32, 17.49, 51.75, 40.79][index],
            faceValue: 1000000,
            maturityDate: `${maturity.year}/${maturity.month.toString().padStart(2, '0')}/${maturity.day.toString().padStart(2, '0')}`,
            daysRemaining: daysRemaining,
            isExpired: isExpired,
            couponRate: [20, 22, 25, 18, 24, 21, 23][index],
            isin: [
                'IRB3TR260661',
                'IRB3TR150531',
                'IRB4O1290741',
                'IRB3TR160591',
                'IRB4O1300691',
                'IRB3TR2505A1',
                'IRB3TR230571'
            ][index],
            category: 'اوراق تامین مالی',
            lastUpdate: '16:48:02'
        };
    });
}

function updateStatus(status, message) {
    statusIndicator.className = `status-indicator ${status}`;
    statusText.textContent = message;
}

function updateDashboard() {
    if (bondsData.length === 0) {
        console.log('No bonds data to update dashboard');
        return;
    }
    
    const yields = bondsData.map(bond => parseFloat(bond.yield));
    const avgYieldValue = yields.reduce((sum, yield) => sum + yield, 0) / yields.length;
    const maxYieldValue = Math.max(...yields);
    const minYieldValue = Math.min(...yields);
    
    console.log('Dashboard stats:', {
        total: bondsData.length,
        avgYield: avgYieldValue,
        maxYield: maxYieldValue,
        minYield: minYieldValue
    });
    
    totalBonds.textContent = bondsData.length.toLocaleString('fa-IR');
    avgYield.textContent = avgYieldValue.toFixed(2) + '%';
    maxYield.textContent = maxYieldValue.toFixed(2) + '%';
    minYield.textContent = minYieldValue.toFixed(2) + '%';
}

function createCharts() {
    if (bondsData.length === 0) {
        console.log('No data to create charts');
        return;
    }
    
    createYieldDistributionChart();
    createRiskFreeRateChart();
}

function createYieldDistributionChart() {
    const ctx = document.getElementById('yieldDistributionChart').getContext('2d');
    
    if (yieldDistributionChart) {
        yieldDistributionChart.destroy();
    }
    
    const yields = bondsData.map(bond => parseFloat(bond.yield));
    console.log('Yields for distribution chart:', yields);
    
    // Adjust ranges based on actual data
    const maxYield = Math.max(...yields);
    const minYield = Math.min(...yields);
    const range = maxYield - minYield;
    
    let yieldRanges;
    if (range <= 20) {
        yieldRanges = [
            { min: 0, max: 10, label: '0-10%' },
            { min: 10, max: 20, label: '10-20%' },
            { min: 20, max: 30, label: '20-30%' },
            { min: 30, max: 40, label: '30-40%' },
            { min: 40, max: 50, label: '40-50%' }
        ];
    } else {
        // Dynamic ranges based on actual data
        const step = Math.ceil(range / 5);
        yieldRanges = [];
        for (let i = 0; i < 5; i++) {
            const min = Math.floor(minYield) + (i * step);
            const max = Math.floor(minYield) + ((i + 1) * step);
            yieldRanges.push({
                min: min,
                max: max,
                label: `${min}-${max}%`
            });
        }
    }
    
    const data = yieldRanges.map(range => {
        const count = yields.filter(yield => yield >= range.min && yield < range.max).length;
        return count;
    });
    
    const labels = yieldRanges.map(range => range.label);
    
    console.log('Chart data:', { labels, data });
    
    yieldDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'تعداد اوراق',
                data: data,
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(118, 75, 162, 0.8)',
                    'rgba(255, 193, 7, 0.8)',
                    'rgba(40, 167, 69, 0.8)',
                    'rgba(220, 53, 69, 0.8)'
                ],
                borderColor: [
                    'rgba(102, 126, 234, 1)',
                    'rgba(118, 75, 162, 1)',
                    'rgba(255, 193, 7, 1)',
                    'rgba(40, 167, 69, 1)',
                    'rgba(220, 53, 69, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'توزیع بازده اوراق تامین مالی',
                    font: {
                        family: 'Vazirmatn',
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: {
                            family: 'Vazirmatn'
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            family: 'Vazirmatn'
                        }
                    }
                }
            }
        }
    });
}

function createRiskFreeRateChart() {
    const ctx = document.getElementById('riskFreeRateChart').getContext('2d');
    
    if (riskFreeRateChart) {
        riskFreeRateChart.destroy();
    }
    
    const yields = bondsData.map(bond => parseFloat(bond.yield));
    const avgRiskFreeRate = yields.reduce((sum, yield) => sum + yield, 0) / yields.length;
    
    // Create time series data (simulated)
    const timeLabels = bondsData.map((_, index) => `دوره ${index + 1}`);
    const riskFreeRates = bondsData.map((_, index) => {
        // Simulate some variation around the average
        return avgRiskFreeRate + (Math.random() - 0.5) * 2;
    });
    
    console.log('Risk-free rate chart data:', { timeLabels, riskFreeRates });
    
    riskFreeRateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [{
                label: 'نرخ بازده بدون ریسک',
                data: riskFreeRates,
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'نرخ بازده بدون ریسک در طول زمان',
                    font: {
                        family: 'Vazirmatn',
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        font: {
                            family: 'Vazirmatn'
                        },
                        callback: function(value) {
                            return value.toFixed(2) + '%';
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            family: 'Vazirmatn'
                        }
                    }
                }
            }
        }
    });
}

function renderBondsTable() {
    bondsTableBody.innerHTML = '';
    
    if (filteredData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="8" style="text-align: center; padding: 20px;">هیچ داده‌ای برای نمایش وجود ندارد</td>';
        bondsTableBody.appendChild(row);
        return;
    }
    
    filteredData.forEach(bond => {
        const row = document.createElement('tr');
        
        // Determine maturity status and styling
        let maturityStatus = '';
        let statusClass = '';
        
        if (bond.isExpired) {
            maturityStatus = 'منقضی شده';
            statusClass = 'expired';
        } else if (bond.daysToMaturity <= 30) {
            maturityStatus = 'نزدیک به سررسید';
            statusClass = 'near-maturity';
        } else if (bond.daysToMaturity <= 90) {
            maturityStatus = 'میان‌مدت';
            statusClass = 'medium-term';
        } else {
            maturityStatus = 'بلندمدت';
            statusClass = 'long-term';
        }
        
        // Format days remaining
        let daysDisplay = '';
        if (bond.daysToMaturity !== null) {
            if (bond.isExpired) {
                daysDisplay = `${Math.abs(bond.daysToMaturity)} روز گذشته`;
            } else {
                daysDisplay = `${bond.daysToMaturity} روز`;
            }
        } else {
            daysDisplay = 'نامشخص';
        }
        
        // Format maturity date
        let maturityDateDisplay = '';
        if (bond.maturityDate) {
            maturityDateDisplay = bond.maturityDate.toLocaleDateString('fa-IR');
        } else {
            maturityDateDisplay = 'نامشخص';
        }
        
        // Calculate yield (simplified calculation)
        const yield = bond.lastPrice > 0 ? ((1000000 - bond.lastPrice) / bond.lastPrice * 100).toFixed(2) : '0.00';
        
        row.innerHTML = `
            <td>${bond.name}</td>
            <td>${bond.symbol}</td>
            <td class="${getYieldClass(yield)}">${yield}%</td>
            <td>${bond.lastPrice.toLocaleString('fa-IR')}</td>
            <td>${bond.volume.toLocaleString('fa-IR')}</td>
            <td>${maturityDateDisplay}</td>
            <td class="${statusClass}">${maturityStatus}</td>
            <td class="${statusClass}">${daysDisplay}</td>
        `;
        bondsTableBody.appendChild(row);
    });
    
    console.log('Rendered table with', filteredData.length, 'rows');
}

function getYieldClass(yield) {
    const yieldNum = parseFloat(yield);
    if (yieldNum >= 40) return 'yield-high';
    if (yieldNum >= 20) return 'yield-medium';
    return 'yield-low';
}



function calculateYield() {
    const bondPrice = parseFloat(document.getElementById('bond-price').value);
    const faceValue = parseFloat(document.getElementById('face-value').value);
    const couponRate = parseFloat(document.getElementById('coupon-rate').value);
    const timeToMaturity = parseFloat(document.getElementById('time-to-maturity').value);
    
    if (!bondPrice || !faceValue || !couponRate || !timeToMaturity) {
        showCalculationResult('لطفاً تمام فیلدها را پر کنید', 'error');
        return;
    }
    
    if (bondPrice <= 0 || faceValue <= 0 || couponRate < 0 || timeToMaturity <= 0) {
        showCalculationResult('مقادیر وارد شده نامعتبر هستند', 'error');
        return;
    }
    
    // Calculate Yield to Maturity (YTM) using approximation
    const couponPayment = (faceValue * couponRate / 100);
    const priceDifference = faceValue - bondPrice;
    const averagePrice = (faceValue + bondPrice) / 2;
    
    const ytm = ((couponPayment + (priceDifference / timeToMaturity)) / averagePrice * 100).toFixed(2);
    
    const resultText = `
        <strong>نتیجه محاسبه:</strong><br>
        بازده تا سررسید: <span class="yield-high">${ytm}%</span><br>
        پرداخت کوپن سالانه: ${couponPayment.toLocaleString('fa-IR')} ریال<br>
        تفاوت قیمت: ${priceDifference.toLocaleString('fa-IR')} ریال
    `;
    
    showCalculationResult(resultText, 'success');
}

function showCalculationResult(message, type) {
    calculationResult.innerHTML = message;
    calculationResult.className = `calculation-result show ${type}`;
    
    setTimeout(() => {
        calculationResult.classList.remove('show');
    }, 5000);
}

// Utility function to format numbers in Persian
function formatNumber(num) {
    return num.toLocaleString('fa-IR');
}

// Export functions for potential future use
window.BondCalculator = {
    fetchBondsData,
    calculateYield,
    bondsData: () => bondsData
};
