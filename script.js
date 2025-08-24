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
            const maturityDate = calculateMaturityFromISIN(item.isin) || 'N/A';
            
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
    if (!isin || isin.length < 8) return 'N/A';
    
    try {
        // Extract date from ISIN (format: IRB3TR260661)
        // The last 6 digits might contain date information
        const datePart = isin.slice(-6);
        const year = '14' + datePart.slice(0, 2); // Assuming 1400s
        const month = datePart.slice(2, 4);
        const day = datePart.slice(4, 6);
        
        if (parseInt(month) > 0 && parseInt(month) <= 12 && parseInt(day) > 0 && parseInt(day) <= 31) {
            return `${year}/${month}/${day}`;
        }
    } catch (e) {
        console.log('Error parsing ISIN date:', e);
    }
    
    return 'N/A';
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
    return [
        {
            name: 'اسناد خزانه-م1-س.قوا03-060615',
            code: 'اخزا301',
            price: 538930,
            volume: 167518,
            yield: 85.68,
            faceValue: 1000000,
            maturityDate: '1405/06/06',
            couponRate: 20,
            isin: 'IRB3TR260661',
            category: 'اوراق تامین مالی',
            lastUpdate: '16:48:02'
        },
        {
            name: 'اسنادخزانه-م1بودجه02-050325',
            code: 'اخزا201',
            price: 784870,
            volume: 104390,
            yield: 27.42,
            faceValue: 1000000,
            maturityDate: '1404/12/05',
            couponRate: 22,
            isin: 'IRB3TR150531',
            category: 'اوراق تامین مالی',
            lastUpdate: '14:59:59'
        },
        {
            name: 'مرابحه عام دولت226-ش.خ070414',
            code: 'اراد226',
            price: 815000,
            volume: 19315000,
            yield: 22.70,
            faceValue: 1000000,
            maturityDate: '1404/07/07',
            couponRate: 25,
            isin: 'IRB4O1290741',
            category: 'اوراق تامین مالی',
            lastUpdate: '14:44:26'
        },
        {
            name: 'اسنادخزانه-م2بودجه02-050923',
            code: 'اخزا202',
            price: 674260,
            volume: 51729,
            yield: 48.32,
            faceValue: 1000000,
            maturityDate: '1404/06/09',
            couponRate: 18,
            isin: 'IRB3TR160591',
            category: 'اوراق تامین مالی',
            lastUpdate: '14:52:45'
        },
        {
            name: 'مرابحه عام دولت227-ش.خ060921',
            code: 'اراد227',
            price: 851100,
            volume: 10380000,
            yield: 17.49,
            faceValue: 1000000,
            maturityDate: '1404/06/06',
            couponRate: 24,
            isin: 'IRB4O1300691',
            category: 'اوراق تامین مالی',
            lastUpdate: '12:40:52'
        },
        {
            name: 'اسناد خزانه-م13بودجه02-051021',
            code: 'اخزا213',
            price: 659000,
            volume: 10726,
            yield: 51.75,
            faceValue: 1000000,
            maturityDate: '1404/10/10',
            couponRate: 21,
            isin: 'IRB3TR2505A1',
            category: 'اوراق تامین مالی',
            lastUpdate: '14:40:55'
        },
        {
            name: 'اسناد خزانه-م11بودجه02-050720',
            code: 'اخزا211',
            price: 710300,
            volume: 322781,
            yield: 40.79,
            faceValue: 1000000,
            maturityDate: '1404/04/07',
            couponRate: 23,
            isin: 'IRB3TR230571',
            category: 'اوراق تامین مالی',
            lastUpdate: '14:53:42'
        }
    ];
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
        row.innerHTML = '<td colspan="6" style="text-align: center; padding: 20px;">هیچ داده‌ای برای نمایش وجود ندارد</td>';
        bondsTableBody.appendChild(row);
        return;
    }
    
    bondsData.forEach(bond => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${bond.name}</td>
            <td>${bond.code}</td>
            <td class="${getYieldClass(bond.yield)}">${bond.yield}%</td>
            <td>${bond.price.toLocaleString('fa-IR')}</td>
            <td>${bond.volume.toLocaleString('fa-IR')}</td>
            <td>${bond.maturityDate}</td>
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
