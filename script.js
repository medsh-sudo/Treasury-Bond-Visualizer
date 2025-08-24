// Global variables
let bondsData = [];
let yieldDistributionChart = null;
let riskFreeRateChart = null;

// API Configuration
const API_URL = 'https://brsapi.ir/Api/Tsetmc/AllSymbols.php?key=BHiTdivFjl9mbgBec5euCt3apTaC43kn&type=4';

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
    searchInput.addEventListener('input', filterBonds);
    sortSelect.addEventListener('change', sortBonds);
    calculateBtn.addEventListener('click', calculateYield);
}

async function fetchBondsData() {
    updateStatus('loading', 'در حال دریافت داده‌ها...');
    
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw API data:', data); // Debug log
        
        if (data && Array.isArray(data)) {
            bondsData = processBondsData(data);
            console.log('Processed bonds data:', bondsData); // Debug log
            
            if (bondsData.length > 0) {
                updateStatus('connected', `داده‌ها با موفقیت دریافت شد (${bondsData.length} اوراق)`);
                updateDashboard();
                createCharts();
                renderBondsTable();
            } else {
                throw new Error('هیچ اوراق تامین مالی در داده‌ها یافت نشد');
            }
        } else {
            throw new Error('داده‌های دریافتی نامعتبر است');
        }
        
    } catch (error) {
        console.error('Error fetching bonds data:', error);
        updateStatus('error', 'خطا در دریافت داده‌ها');
        
        // Fallback to sample data for demonstration
        bondsData = getSampleData();
        updateStatus('connected', 'نمایش داده‌های نمونه');
        updateDashboard();
        createCharts();
        renderBondsTable();
    }
}

function processBondsData(rawData) {
    console.log('Processing raw data with', rawData.length, 'items');
    
    // Filter for financial instruments (bonds, sukuk, treasury bills)
    const processedData = rawData
        .filter(item => {
            // Check if item exists and is a financial instrument
            return item && (
                item.cs === "اوراق تامین مالی" || 
                item.cs === "سرمایه‌گذاری‌ها" ||
                (item.l30 && (
                    item.l30.includes('اسناد خزانه') ||
                    item.l30.includes('مرابحه') ||
                    item.l30.includes('صکوک') ||
                    item.l30.includes('مشارکت')
                ))
            );
        })
        .map(item => {
            console.log('Processing item:', item); // Debug individual items
            
            // Extract data from API response
            const name = item.l30 || item.l18 || 'اوراق تامین مالی';
            const code = item.l18 || item.isin || 'N/A';
            const price = parseFloat(item.pl || item.pc || item.pf || 0); // Last price, current price, or final price
            const volume = parseInt(item.tvol || item.z || 0); // Total volume or base volume
            const faceValue = parseFloat(item.z || 1000000); // Base volume as face value
            
            // Calculate yield based on price and face value
            let yield = 0;
            if (price > 0 && faceValue > 0) {
                // Calculate yield: (Face Value - Current Price) / Current Price * 100
                yield = ((faceValue - price) / price * 100).toFixed(2);
            }
            
            // Calculate maturity date from ISIN or use default
            const maturityInfo = calculateMaturityFromISIN(item.isin);
            const maturityDate = maturityInfo.date || 'N/A';
            const daysRemaining = maturityInfo.daysRemaining;
            const isExpired = maturityInfo.isExpired;
            
            // Estimate coupon rate based on yield or use default
            const couponRate = parseFloat(item.couponRate || 20);
            
            return {
                name: name,
                code: code,
                price: price,
                volume: volume,
                yield: yield,
                faceValue: faceValue,
                maturityDate: maturityDate,
                daysRemaining: daysRemaining,
                isExpired: isExpired,
                couponRate: couponRate,
                isin: item.isin,
                category: item.cs,
                lastUpdate: item.time
            };
        })
        .filter(bond => {
            // Filter out invalid bonds
            const isValid = bond.price > 0 && parseFloat(bond.yield) > 0 && parseFloat(bond.yield) < 100;
            if (!isValid) {
                console.log('Filtered out bond:', bond);
            }
            return isValid;
        });
    
    console.log('Final processed data:', processedData);
    return processedData;
}

function calculateMaturityFromISIN(isin) {
    if (!isin || isin.length < 8) {
        return {
            date: 'N/A',
            daysRemaining: null,
            isExpired: false
        };
    }
    
    try {
        // Extract date from ISIN (format: IRB3TR260661)
        // The last 6 digits might contain date information
        const datePart = isin.slice(-6);
        const year = parseInt('14' + datePart.slice(0, 2)); // Assuming 1400s
        const month = parseInt(datePart.slice(2, 4));
        const day = parseInt(datePart.slice(4, 6));
        
        if (month > 0 && month <= 12 && day > 0 && day <= 31) {
            // Convert Persian date to Gregorian for calculation
            const gregorianDate = persianToGregorian(year, month, day);
            const maturityDate = new Date(gregorianDate);
            const today = new Date();
            
            // Calculate days remaining
            const timeDiff = maturityDate.getTime() - today.getTime();
            const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
            const isExpired = daysRemaining < 0;
            
            return {
                date: `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`,
                daysRemaining: daysRemaining,
                isExpired: isExpired
            };
        }
    } catch (e) {
        console.log('Error parsing ISIN date:', e);
    }
    
    return {
        date: 'N/A',
        daysRemaining: null,
        isExpired: false
    };
}

function persianToGregorian(pYear, pMonth, pDay) {
    // Simple Persian to Gregorian conversion
    // This is a basic conversion - for more accurate results, use a proper library
    const gregorianYear = pYear - 621;
    const gregorianMonth = pMonth + 2; // Approximate offset
    const gregorianDay = pDay;
    
    // Adjust for month overflow
    let adjustedMonth = gregorianMonth;
    let adjustedYear = gregorianYear;
    
    if (adjustedMonth > 12) {
        adjustedMonth -= 12;
        adjustedYear += 1;
    }
    
    return `${adjustedYear}-${adjustedMonth.toString().padStart(2, '0')}-${gregorianDay.toString().padStart(2, '0')}`;
}

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
    
    if (bondsData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="8" style="text-align: center; padding: 20px;">هیچ داده‌ای برای نمایش وجود ندارد</td>';
        bondsTableBody.appendChild(row);
        return;
    }
    
    bondsData.forEach(bond => {
        const row = document.createElement('tr');
        
        // Determine maturity status and styling
        let maturityStatus = '';
        let statusClass = '';
        
        if (bond.isExpired) {
            maturityStatus = 'منقضی شده';
            statusClass = 'expired';
        } else if (bond.daysRemaining <= 30) {
            maturityStatus = 'نزدیک به سررسید';
            statusClass = 'near-maturity';
        } else if (bond.daysRemaining <= 90) {
            maturityStatus = 'میان‌مدت';
            statusClass = 'medium-term';
        } else {
            maturityStatus = 'بلندمدت';
            statusClass = 'long-term';
        }
        
        // Format days remaining
        let daysDisplay = '';
        if (bond.daysRemaining !== null) {
            if (bond.isExpired) {
                daysDisplay = `${Math.abs(bond.daysRemaining)} روز گذشته`;
            } else {
                daysDisplay = `${bond.daysRemaining} روز`;
            }
        } else {
            daysDisplay = 'نامشخص';
        }
        
        row.innerHTML = `
            <td>${bond.name}</td>
            <td>${bond.code}</td>
            <td class="${getYieldClass(bond.yield)}">${bond.yield}%</td>
            <td>${bond.price.toLocaleString('fa-IR')}</td>
            <td>${bond.volume.toLocaleString('fa-IR')}</td>
            <td>${bond.maturityDate}</td>
            <td class="${statusClass}">${maturityStatus}</td>
            <td class="${statusClass}">${daysDisplay}</td>
        `;
        bondsTableBody.appendChild(row);
    });
    
    console.log('Rendered table with', bondsData.length, 'rows');
}

function getYieldClass(yield) {
    const yieldNum = parseFloat(yield);
    if (yieldNum >= 40) return 'yield-high';
    if (yieldNum >= 20) return 'yield-medium';
    return 'yield-low';
}

function filterBonds() {
    const searchTerm = searchInput.value.toLowerCase();
    const rows = bondsTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function sortBonds() {
    const sortBy = sortSelect.value;
    
    bondsData.sort((a, b) => {
        switch (sortBy) {
            case 'yield-desc':
                return parseFloat(b.yield) - parseFloat(a.yield);
            case 'yield-asc':
                return parseFloat(a.yield) - parseFloat(b.yield);
            case 'name':
                return a.name.localeCompare(b.name, 'fa');
            case 'volume':
                return b.volume - a.volume;
            case 'maturity':
                if (a.daysRemaining === null && b.daysRemaining === null) return 0;
                if (a.daysRemaining === null) return 1;
                if (b.daysRemaining === null) return -1;
                return a.daysRemaining - b.daysRemaining;
            default:
                return 0;
        }
    });
    
    renderBondsTable();
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
