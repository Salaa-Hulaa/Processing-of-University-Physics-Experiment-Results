// 基本功能函数
function toggleGuide() {
    const guideContent = document.querySelector('.guide-content');
    if (guideContent) {
        guideContent.style.display = guideContent.style.display === 'none' ? 'block' : 'none';
    }
}

// 添加变量
function addVariable() {
    const container = document.getElementById('variables-container');
    const varDiv = document.createElement('div');
    varDiv.className = 'variable-row';
    
    varDiv.innerHTML = `
        <input type="text" placeholder="变量名" class="var-name">
        <textarea class="var-data" placeholder="输入多组数据，用逗号或空格分隔"></textarea>
        <input type="number" placeholder="仪器精度" class="var-precision" step="any">
        <input type="text" placeholder="单位" class="var-unit">
        <div class="uncertainty-controls">
            <select class="uncertainty-type">
                <option value="a">A类</option>
                <option value="b">B类</option>
            </select>
        </div>
        <div class="variable-actions">
            <button onclick="removeVariable(this)">删除</button>
            <button onclick="calculateVariableStats(this)">计算统计量</button>
        </div>
    `;
    
    container.appendChild(varDiv);
    updateVariableSelects();
}

// 删除变量
function removeVariable(button) {
    const row = button.closest('.variable-row');
    if (row) {
        row.remove();
        updateVariableSelects();
    }
}

// 更新变量选择下拉框
function updateVariableSelects() {
    const variables = Array.from(document.getElementsByClassName('var-name'))
        .map(input => input.value)
        .filter(name => name);
    
    document.querySelectorAll('.x-axis, .y-axis').forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '';
        variables.forEach(varName => {
            const option = document.createElement('option');
            option.value = varName;
            option.textContent = varName;
            select.appendChild(option);
        });
        if (variables.includes(currentValue)) {
            select.value = currentValue;
        }
    });
}

// 计算变量统计量
function calculateVariableStats(button) {
    const row = button.closest('.variable-row');
    if (!row) return;

    const name = row.querySelector('.var-name').value;
    const dataText = row.querySelector('.var-data').value;
    const precision = parseFloat(row.querySelector('.var-precision').value);
    const uncertaintyType = row.querySelector('.uncertainty-type').value;

    // 解析数据
    const data = dataText.split(/[,\s]+/).map(Number).filter(x => !isNaN(x));
    
    if (data.length < 1) {
        alert('需要至少1个有效的数据点');
        return;
    }

    // 计算统计量
    const mean = data.reduce((a, b) => a + b) / data.length;
    const variance = data.length > 1 ? 
        data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (data.length - 1) : 0;
    const standardDeviation = Math.sqrt(variance);
    
    // 计算不确定度
    let uncertainty;
    if (uncertaintyType === 'a' && data.length > 1) {
        uncertainty = standardDeviation / Math.sqrt(data.length);
    } else {
        uncertainty = precision / Math.sqrt(3);
    }

    // 存储计算结果
    row.dataset.stats = JSON.stringify({
        name,
        mean,
        standardDeviation,
        uncertainty,
        unit: row.querySelector('.var-unit').value
    });

    // 显示统计结果
    const statsDiv = row.querySelector('.variable-stats') || document.createElement('div');
    statsDiv.className = 'variable-stats';
    statsDiv.innerHTML = `
        <div class="stats-section">
            <h4>统计结果</h4>
            <p>平均值：${mean.toFixed(6)}</p>
            <p>标准差：${standardDeviation.toFixed(6)}</p>
            <p>不确定度：${uncertainty.toFixed(6)}</p>
            <p>数据点数：${data.length}</p>
        </div>
    `;
    
    if (!row.querySelector('.variable-stats')) {
        row.appendChild(statsDiv);
    }
}

// 修约规则对象
const RoundingRules = {
    // 获取有效数字的位数
    getSignificantDigits(value, uncertainty) {
        const scientificUncertainty = this.toScientific(uncertainty);
        const firstSignificantDigit = Math.floor(Math.log10(scientificUncertainty.value));
        const firstDigit = Math.floor(scientificUncertainty.value / Math.pow(10, firstSignificantDigit));
        
        let decimalPlaces;
        if (firstDigit <= 2) {
            decimalPlaces = -firstSignificantDigit + 1;
        } else {
            decimalPlaces = -firstSignificantDigit;
        }
        
        return {
            decimalPlaces,
            scientificNotation: this.toScientific(value)
        };
    },

    // 转换为科学记数法
    toScientific(number) {
        const exponent = Math.floor(Math.log10(Math.abs(number)));
        const value = number / Math.pow(10, exponent);
        return { value, exponent };
    },

    // 修约数值
    roundValue(value, uncertainty) {
        const { decimalPlaces } = this.getSignificantDigits(value, uncertainty);
        return this.roundToDecimalPlaces(value, decimalPlaces);
    },

    // 修约不确定度
    roundUncertainty(uncertainty) {
        const scientific = this.toScientific(uncertainty);
        const firstDigit = Math.floor(scientific.value);
        const decimalPlaces = firstDigit <= 2 ? 1 : 0;
        return this.roundToDecimalPlaces(uncertainty, -scientific.exponent + decimalPlaces);
    },

    // 按小数位数修约
    roundToDecimalPlaces(number, places) {
        const factor = Math.pow(10, places);
        return Math.round(number * factor) / factor;
    },

    // 格式化最终结果
    formatFinalResult(value, uncertainty, unit) {
        const roundedValue = this.roundValue(value, uncertainty);
        const roundedUncertainty = this.roundUncertainty(uncertainty);
        
        const valueScientific = this.toScientific(roundedValue);
        const uncertaintyScientific = this.toScientific(roundedUncertainty);
        
        const useScientific = Math.abs(valueScientific.exponent) > 4;
        
        if (useScientific) {
            return {
                formatted: `(${(valueScientific.value).toFixed(2)} ± ${(uncertaintyScientific.value).toFixed(2)}) × 10^${valueScientific.exponent} ${unit}`,
                value: roundedValue,
                uncertainty: roundedUncertainty
            };
        } else {
            return {
                formatted: `(${roundedValue} ± ${roundedUncertainty}) ${unit}`,
                value: roundedValue,
                uncertainty: roundedUncertainty
            };
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否是首次访问
    if (!localStorage.getItem('hasVisited')) {
        document.querySelector('.guide-content').style.display = 'block';
        localStorage.setItem('hasVisited', 'true');
    }
    
    addVariable();
});

// 修改计算结果函数以处理多表达式并增强错误处理
function calculateResult() {
    const formula = document.getElementById('formula').value.trim(); // 添加trim()去除空白字符
    const resultsContainer = document.getElementById('results-container');
    
    if (!formula) {
        resultsContainer.innerHTML = '<p class="error">请填写公式。</p>';
        return;
    }

    try {
        // 创建计算步骤容器
        const calculationSteps = document.createElement('div');
        calculationSteps.className = 'calculation-steps';
        
        // 第1步：收集变量数据
        const variableStep = document.createElement('div');
        variableStep.className = 'step';
        const scope = { pi: Math.PI, e: Math.E };
        const uncertainties = {};
        const variableData = {};
        
        document.querySelectorAll('.variable-row').forEach(row => {
            const name = row.querySelector('.var-name').value.trim();
            if (!name) return;
            
            try {
                const stats = JSON.parse(row.dataset.stats || '{}');
                if (stats.mean !== undefined) {
                    scope[name] = stats.mean;
                    uncertainties[name] = stats.uncertainty;
                    variableData[name] = {
                        mean: stats.mean,
                        uncertainty: stats.uncertainty,
                        unit: stats.unit
                    };
                }
            } catch (e) {
                console.warn(`解析变量 ${name} 的统计数据时出错:`, e);
            }
        });

        // 第2步：计算表达式
        const expressions = formula.split(';').filter(expr => expr.trim());
        let mainResult;
        
        expressions.forEach((expr, index) => {
            const result = math.evaluate(expr, scope);
            const assignMatch = expr.match(/(\w+)\s*=\s*(.+)/);
            if (assignMatch) {
                const varName = assignMatch[1];
                scope[varName] = result;
                if (index === expressions.length - 1) {
                    mainResult = { name: varName, value: result };
                }
            }
        });

        // 第3步：计算不确定度传递
        if (mainResult) {
            const mainExpr = expressions[expressions.length - 1].split('=')[1].trim();
            const parsedExpr = math.parse(mainExpr);
            const variables = Object.keys(scope).filter(v => v !== 'pi' && v !== 'e');
            let uncertaintySum = 0;
            const uncertaintyTerms = [];

            variables.forEach(variable => {
                if (uncertainties[variable]) {
                    try {
                        const derivative = math.derivative(parsedExpr, variable);
                        const derivativeValue = derivative.evaluate(scope);
                        const contribution = Math.pow(derivativeValue * uncertainties[variable], 2);
                        uncertaintySum += contribution;
                        
                        uncertaintyTerms.push({
                            variable,
                            derivative: derivative.toString(),
                            derivativeValue,
                            uncertainty: uncertainties[variable],
                            contribution: Math.sqrt(contribution)
                        });
                    } catch (e) {
                        console.warn(`计算变量 ${variable} 的不确定度贡献时出错:`, e);
                    }
                }
            });

            const totalUncertainty = Math.sqrt(uncertaintySum);
            const relativeUncertainty = (totalUncertainty / Math.abs(mainResult.value)) * 100;

            // 显示计算结果
            calculationSteps.innerHTML = `
                <div class="step">
                    <h4>1. 变量及其不确定度</h4>
                    ${Object.entries(variableData).map(([name, data]) => 
                        `<p>${name} = ${data.mean.toFixed(6)} ± ${data.uncertainty.toFixed(6)} ${data.unit}</p>`
                    ).join('')}
                </div>
                <div class="step">
                    <h4>2. 不确定度传递计算</h4>
                    ${uncertaintyTerms.map(term => `
                        <div class="uncertainty-term">
                            <p>∂(${mainResult.name})/∂${term.variable} = ${term.derivative}</p>
                            <p>值 = ${term.derivativeValue.toFixed(6)}</p>
                            <p>贡献 = ${term.contribution.toFixed(6)}</p>
                        </div>
                    `).join('')}
                </div>
                <div class="step">
                    <h4>3. 最终结果</h4>
                    <p>计算值：${mainResult.value.toFixed(6)}</p>
                    <p>合成标准不确定度：${totalUncertainty.toFixed(6)}</p>
                    <p>相对不确定度：${relativeUncertainty.toFixed(2)}%</p>
                    <p>扩展不确定度(k=2)：${(2 * totalUncertainty).toFixed(6)}</p>
                    <p class="final-result">${mainResult.name} = (${mainResult.value.toFixed(6)} ± ${(2 * totalUncertainty).toFixed(6)})</p>
                </div>
            `;
            
            resultsContainer.innerHTML = '';
            resultsContainer.appendChild(calculationSteps);
        }
    } catch (error) {
        resultsContainer.innerHTML = `
            <p class="error">计算错误：${error.message}</p>
            <p>请检查：</p>
            <ul>
                <li>所有变量是否已正确计算统计量</li>
                <li>公式格式是否正确（每个表达式用分号分隔）</li>
                <li>变量名是否与输入匹配</li>
                <li>数学运算符是否使用正确</li>
            </ul>
        `;
    }
}

// 获取变量单位
function getUnit(variableName) {
    const variableRow = Array.from(document.getElementsByClassName('variable-row'))
        .find(row => row.querySelector('.var-name').value === variableName);
    return variableRow ? variableRow.querySelector('.var-unit').value : '';
}

// 添加示例数据加载函数
async function loadExample() {
    try {
        // 清除现有数据和结果
        document.getElementById('variables-container').innerHTML = '';
        document.getElementById('results-container').innerHTML = '';
        
        const variables = [
            {
                name: 'm',
                data: '0.050, 0.100, 0.150, 0.200, 0.250',
                precision: '0.0001',
                unit: 'kg',
                type: 'b'
            },
            {
                name: 'y',
                data: '0.52, 1.05, 1.58, 2.10, 2.63',
                precision: '0.01',
                unit: 'mm',
                type: 'b'
            },
            {
                name: 'd',
                data: '0.35',
                precision: '0.01',
                unit: 'mm',
                type: 'b'
            },
            {
                name: 'D',
                data: '25.00',
                precision: '0.02',
                unit: 'mm',
                type: 'b'
            },
            {
                name: 'L',
                data: '800',
                precision: '1',
                unit: 'mm',
                type: 'b'
            }
        ];

        // 初始化变量
        for (const v of variables) {
            addVariable();
            const rows = document.querySelectorAll('.variable-row');
            const lastRow = rows[rows.length - 1];
            
            lastRow.querySelector('.var-name').value = v.name;
            lastRow.querySelector('.var-data').value = v.data;
            lastRow.querySelector('.var-precision').value = v.precision;
            lastRow.querySelector('.var-unit').value = v.unit;
            lastRow.querySelector('.uncertainty-type').value = v.type;
            
            // 计算并等待统计量计算完成
            const calcButton = lastRow.querySelector('button[onclick="calculateVariableStats(this)"]');
            calculateVariableStats(calcButton);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 设置计算公式
        const formulaInput = document.getElementById('formula');
        formulaInput.value = `L_m = L/1000;
d_m = d/1000;
D_m = D/1000;
E = (4 * m * 9.794 * (L_m^3))/(pi * (d_m^2) * (D_m^2))`;

        // 等待一会儿确保所有变量都已准备好
        await new Promise(resolve => setTimeout(resolve, 500));

        // 执行计算
        calculateResult();

        // 更新图表
        updatePlot();

    } catch (error) {
        console.error('加载示例数据时出错:', error);
        document.getElementById('results-container').innerHTML = `
            <p class="error">加载示例数据时出错: ${error.message}</p>
        `;
    }
}

// 更新图表函数
function updatePlot() {
    const showErrorBars = document.getElementById('show-error-bars').checked;
    const autoRange = document.getElementById('auto-range').checked;
    const traces = [];

    document.querySelectorAll('.curve-row').forEach(row => {
        const xVar = row.querySelector('.x-axis').value;
        const yVar = row.querySelector('.y-axis').value;
        const showFit = row.querySelector('.show-fit').checked;
        const fitType = row.querySelector('.fit-type').value;

        // 获取数据
        const xRow = Array.from(document.querySelectorAll('.variable-row'))
            .find(r => r.querySelector('.var-name').value === xVar);
        const yRow = Array.from(document.querySelectorAll('.variable-row'))
            .find(r => r.querySelector('.var-name').value === yVar);

        if (xRow && yRow) {
            const xData = xRow.querySelector('.var-data').value.split(/[,\s]+/).map(Number);
            const yData = yRow.querySelector('.var-data').value.split(/[,\s]+/).map(Number);
            const xStats = JSON.parse(xRow.dataset.stats || '{}');
            const yStats = JSON.parse(yRow.dataset.stats || '{}');

            // 创建数据点轨迹
            const dataTrace = {
                x: xData,
                y: yData,
                error_x: {
                    type: 'data',
                    array: Array(xData.length).fill(xStats.uncertainty || 0),
                    visible: showErrorBars
                },
                error_y: {
                    type: 'data',
                    array: Array(yData.length).fill(yStats.uncertainty || 0),
                    visible: showErrorBars
                },
                mode: 'markers',
                type: 'scatter',
                name: `${yVar} vs ${xVar} (数据点)`
            };
            traces.push(dataTrace);

            // 如果需要显示拟合线
            if (showFit && xData.length > 1) {
                const fitResult = applyFit(xData, yData, fitType);
                // 生成拟合线
                let fitTrace;
                if (fitType === 'polynomial') {
                    const xFit = [];
                    const yFit = [];
                    const step = (Math.max(...xData) - Math.min(...xData)) / 100;
                    for (let x = Math.min(...xData); x <= Math.max(...xData); x += step) {
                        xFit.push(x);
                        yFit.push(fitResult.coefficients.reduce((sum, coef, i) => 
                            sum + coef * Math.pow(x, i), 0));
                    }
                    fitTrace = {
                        x: xFit,
                        y: yFit,
                        mode: 'lines',
                        type: 'scatter',
                        name: `多项式拟合`,
                        line: { color: 'red' }
                    };
                } else {
                    // 现有的拟合线代码
            varDiv.className = 'variable-row';
            
            varDiv.innerHTML = `
                <input type="text" placeholder="变量名" class="var-name" value="${v.name}">
                <textarea class="var-data" placeholder="输入多组数据，用逗号或空格分隔">${v.data}</textarea>
                <input type="number" placeholder="仪器精度" class="var-precision" step="any" value="${v.precision}">
                <input type="text" placeholder="单位" class="var-unit" value="${v.unit}">
                <div class="uncertainty-controls">
                    <select class="uncertainty-type">
                        <option value="a" ${v.type === 'a' ? 'selected' : ''}>A类</option>
                        <option value="b" ${v.type === 'b' ? 'selected' : ''}>B类</option>
                    </select>
                </div>
                <div class="variable-actions">
                    <button onclick="removeVariable(this)">删除</button>
                    <button onclick="calculateVariableStats(this)">计算统计量</button>
                </div>
            `;
            
            document.getElementById('variables-container').appendChild(varDiv);
            
            // 计算统计量并等待完成
            await new Promise(resolve => {
                const calcButton = varDiv.querySelector('.variable-actions button:last-child');
                calcButton.click();
                setTimeout(resolve, 100);
            });
        }
        
        // 更新变量选择
        updateVariableSelects();
        
        // 设置计算公式
        const formulaInput = document.getElementById('formula');
        formulaInput.value = `L_m = L/1000;
d_m = d/1000;
D_m = D/1000;
E = (4 * m * 9.794 * (L_m^3))/(pi * (d_m^2) * (D_m^2))`;
        
        // 等待所有数据准备完成后计算结果
        setTimeout(calculateResult, 500);
    };

    // 执行初始化
    initializeVariables().catch(error => {
        console.error('初始化变量时出错:', error);
    });
}

// 更新图表函数
function updatePlot() {
    const showErrorBars = document.getElementById('show-error-bars').checked;
    const autoRange = document.getElementById('auto-range').checked;
    const traces = [];

    document.querySelectorAll('.curve-row').forEach(row => {
        const xVar = row.querySelector('.x-axis').value;
        const yVar = row.querySelector('.y-axis').value;
        const showFit = row.querySelector('.show-fit').checked;
        const fitType = row.querySelector('.fit-type').value;

        // 获取数据
        const xRow = Array.from(document.querySelectorAll('.variable-row'))
            .find(r => r.querySelector('.var-name').value === xVar);
        const yRow = Array.from(document.querySelectorAll('.variable-row'))
            .find(r => r.querySelector('.var-name').value === yVar);

        if (xRow && yRow) {
            const xData = xRow.querySelector('.var-data').value.split(/[,\s]+/).map(Number);
            const yData = yRow.querySelector('.var-data').value.split(/[,\s]+/).map(Number);
            const xStats = JSON.parse(xRow.dataset.stats || '{}');
            const yStats = JSON.parse(yRow.dataset.stats || '{}');

            // 创建数据点轨迹
            const dataTrace = {
                x: xData,
                y: yData,
                error_x: {
                    type: 'data',
                    array: Array(xData.length).fill(xStats.uncertainty || 0),
                    visible: showErrorBars
                },
                error_y: {
                    type: 'data',
                    array: Array(yData.length).fill(yStats.uncertainty || 0),
                    visible: showErrorBars
                },
                mode: 'markers',
                type: 'scatter',
                name: `${yVar} vs ${xVar} (数据点)`
            };
            traces.push(dataTrace);

            // 如果需要显示拟合线
            if (showFit && xData.length > 1) {
                const fitResult = applyFit(xData, yData, fitType);
                // 生成拟合线
                let fitTrace;
                if (fitType === 'polynomial') {
                    const xFit = [];
                    const yFit = [];
                    const step = (Math.max(...xData) - Math.min(...xData)) / 100;
                    for (let x = Math.min(...xData); x <= Math.max(...xData); x += step) {
                        xFit.push(x);
                        yFit.push(fitResult.coefficients.reduce((sum, coef, i) => 
                            sum + coef * Math.pow(x, i), 0));
                    }
                    fitTrace = {
                        x: xFit,
                        y: yFit,
                        mode: 'lines',
                        type: 'scatter',
                        name: `多项式拟合`,
                        line: { color: 'red' }
                    };
                } else {
                    // 现有的拟合线代码
                    const { slope, intercept, correlation } = linearFit(xData, yData);
                
                    // 生成拟合线数据点
                    const xFit = [Math.min(...xData), Math.max(...xData)];
                    const yFit = xFit.map(x => slope * x + intercept);

                    fitTrace = {
                        x: xFit,
                        y: yFit,
                        mode: 'lines',
                        type: 'scatter',
                        name: `拟合线: ${yVar} = (${slope.toFixed(4)})${xVar} + (${intercept.toFixed(4)})`,
                        line: { color: 'red' }
                    };
                }
                traces.push(fitTrace);

                // ���储拟合参数供后续使用
                window.fitParameters = {
                    slope,
                    intercept,
                    correlation,
                    xVar,
                    yVar
                };
            }
        }
    });

    // 设置布局
    const layout = {
        title: '数据拟合图',
        showlegend: true,
        legend: {
            x: 1,
            xanchor: 'right',
            y: 1
        },
        xaxis: { title: '自变量' },
        yaxis: { title: '因变量' }
    };

    if (!autoRange) {
        layout.xaxis.range = [
            parseFloat(document.getElementById('x-min').value),
            parseFloat(document.getElementById('x-max').value)
        ];
        layout.yaxis.range = [
            parseFloat(document.getElementById('y-min').value),
            parseFloat(document.getElementById('y-max').value)
        ];
    }

    // 绘制图表
    Plotly.newPlot('plot-canvas', traces, layout, {
        responsive: true,
        scrollZoom: true,
        displayModeBar: true,
        modeBarButtonsToAdd: ['drawopenpath', 'eraseshape']
    });
}

// 线性拟合函数
function linearFit(xData, yData) {
    const n = xData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += xData[i];
        sumY += yData[i];
        sumXY += xData[i] * yData[i];
        sumXX += xData[i] * xData[i];
        sumYY += yData[i] * yData[i];
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // 计算相关系数
    const correlation = (n * sumXY - sumX * sumY) / 
        Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return { slope, intercept, correlation };
}

// 添加提取变量函数
function extractVariables(formula) {
    // 移除所有空格和注释
    const cleanFormula = formula.replace(/\/\/.*$/gm, '')  // 移除单行注释
        .replace(/\/\*[\s\S]*?\*\//g, '')  // 移除多行注释
        .replace(/\s+/g, '');  // 移除空格
    
    // 替换 'π' 为 'pi'
    const normalizedFormula = cleanFormula.replace(/π/g, 'pi');
    
    
    // 移除数字（包括科学记数法）
    const noNumbers = noFunctions.replace(/[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?/g, '');
    
    // 移除数学运算符和括号
    const noOperators = noNumbers.replace(/[+\-*/^()=,]/g, ' ');
    
    // 匹配所有合法的变量名（字母开头，可包含字母、数字和下划线）
    const matches = noOperators.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
    
    // 过滤掉数学常量和重复项
    const constants = ['pi', 'e', 'i'];
    const variables = [...new Set(matches)].filter(v => !constants.includes(v));
    
    return variables;
}

// 修改生成不确定度公式函数
function generateUncertaintyFormula() {
    const formula = document.getElementById('formula').value;
    const uncertaintyFormulaField = document.getElementById('uncertainty-formula');
    
    try {
        // 分割多个表达式
        const expressions = formula.split(';').map(expr => expr.trim());
        // 获取最后一个表达式（主要计算公式）
        const mainExpr = expressions[expressions.length - 1];
        
        // 检查是否是赋值表达式
        const assignmentMatch = mainExpr.match(/(\w+)\s*=\s*(.+)/);
        if (!assignmentMatch) {
            throw new Error('最后一个表达式必���是赋值形式（例如：E = ...）');
        }
        
        const resultVariable = assignmentMatch[1];
        const expression = assignmentMatch[2].trim();
        
        // 解析主要计算公式
        const parsedFormula = math.parse(expression);
        
        // 提取变量
        const variables = extractVariables(expression);
        
        // 生成每个变量的不确定度项
        const uncertaintyTerms = variables.map(variable => {
            try {
                // 计算对该变量的偏导数
                const derivative = math.derivative(parsedFormula, variable);
                // 生成该变量的不确定度项
                return {
                    variable,
                    derivative: derivative.toString(),
                    term: `(${derivative.toString()} * Δ${variable})^2`
                };
            } catch (e) {
                console.log(`跳过变量 ${variable}: ${e.message}`);
                return null;
            }
        }).filter(term => term !== null);

        // 生成不确定度传递公式
        const uncertaintyFormula = `
// 不确定度传递公式推导：

1. 对各变量求偏导数：
${uncertaintyTerms.map(term => 
    `∂${resultVariable}/∂${term.variable} = ${term.derivative}`
).join('\n')}

2. 不确定度传递公式：
Δ${resultVariable} = sqrt(${uncertaintyTerms.map(term => term.term).join(' + ')})

3. 相对不确定度：
Δ${resultVariable}/${resultVariable} = sqrt(${uncertaintyTerms.map(term => 
    `(∂${resultVariable}/∂${term.variable} * ${term.variable}/${resultVariable} * Δ${term.variable}/${term.variable})^2`
).join(' + ')})

4. 各变量的相对不确定度：
${variables.map(v => `Δ${v}/${v}`).join(', ')}

5. 最终的相对不确定度表达式：
Δ${resultVariable}/${resultVariable} = sqrt(${variables.map(v => 
    `(Δ${v}/${v})^2`
).join(' + ')})
`;

        uncertaintyFormulaField.value = uncertaintyFormula;
        
    } catch (error) {
        uncertaintyFormulaField.value = `错误：无法生成不确定度公式\n${error.message}\n\n请确保：\n1. 公式格式正确\n2. 变量名合法\n3. 使用正确的数学运算符`;
    }
}

// 添加到页面加载事件中
document.addEventListener('DOMContentLoaded', () => {
    // ... 现有代码 ...
    
    // 添加自动范围切换事件监听
    const autoRangeCheckbox = document.getElementById('auto-range');
    if (autoRangeCheckbox) {
        autoRangeCheckbox.addEventListener('change', function() {
            const axisRange = document.querySelector('.axis-range');
            if (axisRange) {
                axisRange.style.display = this.checked ? 'none' : 'block';
            }
            if (this.checked) {
                updatePlot();
            }
        });
    }

    // 添加图表相关的事件监听器
    document.querySelectorAll('#show-error-bars, #auto-range').forEach(checkbox => {
        checkbox.addEventListener('change', updatePlot);
    });
    
    document.querySelectorAll('#x-min, #x-max, #y-min, #y-max').forEach(input => {
        input.addEventListener('change', () => {
            if (!document.getElementById('auto-range').checked) {
                updatePlot();
            }
        });
    });
});

// 在现有代码后添加导出功能
function exportData() {
    const data = {
        variables: [],
        formula: document.getElementById('formula').value,
        uncertaintyFormula: document.getElementById('uncertainty-formula').value,
        results: document.getElementById('results-container').innerHTML
    };

    // 收集所有变量数据
    document.querySelectorAll('.variable-row').forEach(row => {
        data.variables.push({
            name: row.querySelector('.var-name').value,
            data: row.querySelector('.var-data').value,
            precision: row.querySelector('.var-precision').value,
            unit: row.querySelector('.var-unit').value,
            uncertaintyType: row.querySelector('.uncertainty-type').value,
            stats: row.dataset.stats
        });
    });

    // 创建下载链接
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '物理实验数据_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

// 添加数据导入功能
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // 清除现有数据
            document.getElementById('variables-container').innerHTML = '';
            
            // 导入变量数据
            data.variables.forEach(v => {
                const varDiv = document.createElement('div');
                varDiv.className = 'variable-row';
                varDiv.innerHTML = `
                    <input type="text" placeholder="变量名" class="var-name" value="${v.name}" oninput="validateVariableName(this)">
                    <textarea class="var-data" placeholder="输入多组数据，用逗号或空格分隔">${v.data}</textarea>
                    <input type="number" placeholder="仪器精度" class="var-precision" step="any" value="${v.precision}">
                    <input type="text" placeholder="单位" class="var-unit" value="${v.unit}">
                    <div class="uncertainty-controls">
                        <select class="uncertainty-type">
                            <option value="a" ${v.uncertaintyType === 'a' ? 'selected' : ''}>A类</option>
                            <option value="b" ${v.uncertaintyType === 'b' ? 'selected' : ''}>B类</option>
                        </select>
                    </div>
                    <div class="variable-actions">
                        <button onclick="removeVariable(this)">删除</button>
                        <button onclick="calculateVariableStats(this)">计算统计量</button>
                    </div>
                `;
                
                document.getElementById('variables-container').appendChild(varDiv);
                if (v.stats) {
                    varDiv.dataset.stats = v.stats;
                    calculateVariableStats(varDiv.querySelector('.variable-actions button:last-child'));
                }
            });

            // 导入公式
            document.getElementById('formula').value = data.formula || '';
            document.getElementById('uncertainty-formula').value = data.uncertaintyFormula || '';
            
            // 更新变量选择下拉框
            updateVariableSelects();
            
            // 如果有结果，显示结果
            if (data.results) {
                document.getElementById('results-container').innerHTML = data.results;
            }

        } catch (error) {
            alert('导入数据格式错误：' + error.message);
        }
    };
    reader.readAsText(file);
}

// 添加单位转换功能
const UnitConverter = {
    // 长度单位转换
    length: {
        mm: 0.001,    // 毫米到米
        cm: 0.01,     // 厘米到米
        m: 1,         // 米（基准单位）
        km: 1000      // 千米到米
    },
    
    // 质量单位转换
    mass: {
        mg: 0.000001, // 毫克到千克
        g: 0.001,     // 克到千克
        kg: 1,        // 千克（基准单位）
        t: 1000       // 吨到千克
    },
    
    // 时间单位转换
    time: {
        ms: 0.001,    // 毫秒到秒
        s: 1,         // 秒（基准单位）
        min: 60,      // 分钟到秒
        h: 3600       // 小时到秒
    },
    
    // 力单位转换
    force: {
        N: 1,         // 牛顿（基准单位）
        kN: 1000,     // 千牛顿到牛顿
        dyn: 0.00001  // 达因到牛顿
    },
    
    // 压力单位转换
    pressure: {
        Pa: 1,        // 帕斯卡（基准单位）
        kPa: 1000,    // 千帕到帕斯卡
        MPa: 1000000, // 兆���到帕斯卡
        atm: 101325   // 标准大气压到帕斯卡
    },

    // 转换函数
    convert(value, fromUnit, toUnit, type) {
        const units = this[type];
        if (!units) throw new Error(`未支持的单位类型：${type}`);
        if (!units[fromUnit]) throw new Error(`未知的源单位：${fromUnit}`);
        if (!units[toUnit]) throw new Error(`未知的目标单位：${toUnit}`);
        
        return value * units[fromUnit] / units[toUnit];
    }
}; 

// 改进不确定度计算函数
function calculateUncertainty(data, type, params = {}) {
    if (type === 'a') {
        // A类不确定度计算
        const n = data.length;
        if (n < 2) throw new Error('A类不确定度需要至少2个数据点');
        
        const mean = data.reduce((a, b) => a + b) / n;
        const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
        const standardDeviation = Math.sqrt(variance);
        const uncertainty = standardDeviation / Math.sqrt(n);
        
        return {
            mean,
            standardDeviation,
            uncertainty,
            relativeUncertainty: uncertainty / Math.abs(mean) * 100
        };
    } else if (type === 'b') {
        // B类不确定度计算
        const { precision, confidenceLevel = 0.6826 } = params;
        if (!precision) throw new Error('B类不确定度需要仪器精度值');
        
        // 根据置信概率确定系数
        let coefficient;
        switch (confidenceLevel) {
            case 0.6826: coefficient = 1; break;    // 1σ
            case 0.9544: coefficient = 2; break;    // 2σ
            case 0.9973: coefficient = 3; break;    // 3σ
            default: coefficient = 1;
        }
        
        const uncertainty = precision / (coefficient * Math.sqrt(3));
        return { uncertainty };
    }
    
    throw new Error('未知的不确定度类型');
} 

// 添加更多拟合模型
const FittingModels = {
    // 线性拟合 y = ax + b
    linear(xData, yData) {
        return linearFit(xData, yData);
    },
    
    // 幂函数拟合 y = ax^b
    power(xData, yData) {
        // ����数转换为线性拟合
        const logX = xData.map(x => Math.log(x));
        const logY = yData.map(y => Math.log(y));
        const { slope, intercept } = linearFit(logX, logY);
        return {
            a: Math.exp(intercept),
            b: slope,
            type: 'power'
        };
    },
    
    // 指数拟合 y = ae^(bx)
    exponential(xData, yData) {
        // 取对数转换为线性拟合
        const logY = yData.map(y => Math.log(y));
        const { slope, intercept } = linearFit(xData, logY);
        return {
            a: Math.exp(intercept),
            b: slope,
            type: 'exponential'
        };
    },
    
    // 多项式拟合
    polynomial(xData, yData, degree = 2) {
        // 使用最小二乘法求解多项式系数
        const matrix = [];
        const vector = [];
        
        for (let i = 0; i <= degree; i++) {
            matrix[i] = [];
            for (let j = 0; j <= degree; j++) {
                matrix[i][j] = xData.reduce((sum, x) => sum + Math.pow(x, i + j), 0);
            }
            vector[i] = xData.reduce((sum, x, k) => sum + yData[k] * Math.pow(x, i), 0);
        }
        
        // 使用math.js求解线性方程组
        const coefficients = math.lusolve(matrix, vector);
        return {
            coefficients: coefficients.map(c => c[0]),
            type: 'polynomial',
            degree
        };
    }
};

// 计算B类不确定度
function calculateTypeBUncertainty() {
    const precision = parseFloat(document.getElementById('instrument-precision').value);
    const confidenceLevel = parseFloat(document.getElementById('confidence-level').value);
    if (isNaN(precision)) {
        alert('请输入有效的仪器精度');
        return;
    }
    const uncertainty = precision / Math.sqrt(3);
    document.getElementById('uncertainty-results').innerHTML = `
        <div class="result-item">
            <p>仪器精度：${precision}</p>
            <p>置信概率：${confidenceLevel}</p>
            <p>不确定度：${uncertainty.toFixed(6)}</p>
        </div>
    `;
}

// 添加曲线功能
function addCurve() {
    const container = document.getElementById('curves-container');
    const curveDiv = document.createElement('div');
    curveDiv.className = 'curve-row';
    
    curveDiv.innerHTML = `
        <select class="x-axis"></select>
        <select class="y-axis"></select>
        <select class="fit-type">
            <option value="linear">线性拟合</option>
            <option value="power">幂函数拟合</option>
            <option value="exponential">指数函数拟合</option>
            <option value="polynomial">多项式拟合</option>
        </select>
        <label><input type="checkbox" class="show-fit" checked> 显示拟合</label>
        <button onclick="removeCurve(this)">删除</button>
    `;
    
    container.appendChild(curveDiv);
    updateVariableSelects();
}

function removeCurve(button) {
    const row = button.closest('.curve-row');
    if (row) {
        row.remove();
        updatePlot();
    }
}

// 计算A类不确定度
function calculateTypeAUncertainty() {
    const dataText = document.getElementById('measurements').value;
    const data = dataText.split(/[,\s]+/).map(Number).filter(x => !isNaN(x));
    
    if (data.length < 2) {
        alert('A类不确定�����需要至少2个数据点');
        return;
    }

    const result = calculateUncertainty(data, 'a');
    
    document.getElementById('uncertainty-results').innerHTML = `
        <div class="result-item">
            <p>平均值：${result.mean.toFixed(6)}</p>
            <p>标准差：${result.standardDeviation.toFixed(6)}</p>
            <p>标准不确定度：${result.uncertainty.toFixed(6)}</p>
            <p>相对不确定��：${result.relativeUncertainty.toFixed(2)}%</p>
        </div>
    `;
}

// 应用拟合
function applyFit(xData, yData, fitType) {
    switch (fitType) {
        case 'linear':
            return FittingModels.linear(xData, yData);
        case 'power':
            return FittingModels.power(xData, yData);
        case 'exponential':
            return FittingModels.exponential(xData, yData);
        case 'polynomial':
            return FittingModels.polynomial(xData, yData, 2);
        default:
            return FittingModels.linear(xData, yData);
    }
}

// 添加单位转换功能界面
function showUnitConverter() {
    const converterDiv = document.createElement('div');
    converterDiv.className = 'unit-converter';
    converterDiv.innerHTML = `
        <h3>单位转换</h3>
        <div class="converter-controls">
            <select id="unit-type">
                <option value="length">长度</option>
                <option value="mass">质量</option>
                <option value="time">时间</option>
                <option value="force">力</option>
                <option value="pressure">压力</option>
            </select>
            <input type="number" id="unit-value" step="any">
            <select id="from-unit"></select>
            <span>→</span>
            <select id="to-unit"></select>
            <button onclick="convertUnit()">转换</button>
        </div>
        <div id="conversion-result"></div>
    `;
    
    document.getElementById('results-container').appendChild(converterDiv);
    updateUnitSelects();
}

function updateUnitSelects() {
    const type = document.getElementById('unit-type').value;
    const units = Object.keys(UnitConverter[type]);
    const fromSelect = document.getElementById('from-unit');
    const toSelect = document.getElementById('to-unit');
    
    [fromSelect, toSelect].forEach(select => {
        select.innerHTML = units.map(unit => 
            `<option value="${unit}">${unit}</option>`
        ).join('');
    });
}

function convertUnit() {
    const type = document.getElementById('unit-type').value;
    const value = parseFloat(document.getElementById('unit-value').value);
    const fromUnit = document.getElementById('from-unit').value;
    const toUnit = document.getElementById('to-unit').value;
    
    try {
        const result = UnitConverter.convert(value, fromUnit, toUnit, type);
        document.getElementById('conversion-result').innerHTML = `
            <p>${value} ${fromUnit} = ${result.toFixed(6)} ${toUnit}</p>
        `;
    } catch (error) {
        document.getElementById('conversion-result').innerHTML = `
            <p style="color: red;">转换错误：${error.message}</p>
        `;
    }
}

// 添加自动不确定度分析功能
const UncertaintyAnalyzer = {
    // 解析表达式并提取变量及其关系
    parseExpression(expr) {
        const parsedExpr = math.parse(expr);
        return {
            variables: this.extractVariables(parsedExpr),
            derivatives: this.calculateDerivatives(parsedExpr)
        };
    },

    // 提取表达式中的变量
    extractVariables(expr) {
        const variables = new Set();
        expr.traverse(node => {
            if (node.type === 'SymbolNode' && !['pi', 'e'].includes(node.name)) {
                variables.add(node.name);
            }
        });
        return Array.from(variables);
    },

    // 计算所有变量的偏导数
    calculateDerivatives(expr) {
        const variables = this.extractVariables(expr);
        const derivatives = {};
        
        variables.forEach(variable => {
            try {
                derivatives[variable] = math.derivative(expr, variable);
            } catch (e) {
                console.warn(`无法计算变量 ${variable} 的偏导数:`, e);
            }
        });
        
        return derivatives;
    },

    // 生成不确定度传递公式
    generateUncertaintyFormula(expr, result) {
        const { variables, derivatives } = this.parseExpression(expr);
        let formula = '标准不确定度传递公式：\n\n';
        
        // 生成各变量的偏导数表达式
        variables.forEach(variable => {
            formula += `∂${result}/∂${variable} = ${derivatives[variable]}\n`;
        });
        
        // 生成合成标准不确定度公式
        formula += '\n合成标准不确定度：\n';
        formula += `Δ${result} = ���(${variables.map(v => 
            `(∂${result}/∂${v})²·(Δ${v})²`
        ).join(' + ')})\n`;
        
        // 生成相对不确定度公式
        formula += '\n相对不确定度：\n';
        formula += `(Δ${result}/${result}) = √(${variables.map(v => 
            `((∂${result}/∂${v})·${v}/${result})²·(Δ${v}/${v})²`
        ).join(' + ')})`;
        
        return formula;
    },

    // 计算不确定度
    calculateUncertainty(expr, variables, uncertainties) {
        const { derivatives } = this.parseExpression(expr);
        let sumSquares = 0;
        
        // 计算每个变量的不确定度贡献
        for (const [variable, value] of Object.entries(variables)) {
            if (uncertainties[variable]) {
                try {
                    const derivative = derivatives[variable];
                    const contribution = math.evaluate(
                        `(${derivative.toString()})^2 * (${uncertainties[variable]})^2`,
                        variables
                    );
                    sumSquares += contribution;
                } catch (e) {
                    console.warn(`计算变量 ${variable} 的不确定度贡献时出错:`, e);
                }
            }
        }
        
        return Math.sqrt(sumSquares);
    }
};

// 修改计算结果函数中的不确定度计算部分
function calculateResult() {
    const formula = document.getElementById('formula').value.trim(); // 添加trim()去除空白字符
    const resultsContainer = document.getElementById('results-container');
    
    try {
        console.log('���始计算，公式：', formula);
        
        // 检查公式是否为空
        if (!formula) {
            throw new Error('请输入计算公式');
        }

        // 收集变量数据
        const variables = { pi: Math.PI, e: Math.E };
        const uncertainties = {};
        const variableData = {};
        
        // 收集所有变量的值和不确定度
        document.querySelectorAll('.variable-row').forEach(row => {
            const name = row.querySelector('.var-name').value.trim();
            if (!name) return;
            
            try {
                const stats = JSON.parse(row.dataset.stats || '{}');
                console.log(`变量 ${name} 的统计数据:`, stats);
                
                if (stats.mean !== undefined) {
                    variables[name] = stats.mean;
                    uncertainties[name] = stats.uncertainty;
                    variableData[name] = {
                        mean: stats.mean,
                        uncertainty: stats.uncertainty,
                        unit: stats.unit
                    };
                }
            } catch (e) {
                console.warn(`解析变量 ${name} 的统计数据时出错:`, e);
            }
        });
        
        console.log('收集到的变量:', variables);
        console.log('收集到的不确定度:', uncertainties);

        // 分割并处理表达式
        const expressions = formula.split(';')
            .map(expr => expr.trim())
            .filter(expr => expr);
        
        console.log('处理的表达式:', expressions);

        // 依次执行表达式
        let result;
        for (const expr of expressions) {
            try {
                console.log('正在计算表达式:', expr);
                result = math.evaluate(expr, variables);
                
                // 更新变量值
                const assignMatch = expr.match(/(\w+)\s*=/);
                if (assignMatch) {
                    const varName = assignMatch[1];
                    variables[varName] = result;
                    console.log(`更新变量 ${varName} = ${result}`);
                }
            } catch (e) {
                throw new Error(`计算表达式 "${expr}" 时出错: ${e.message}`);
            }
        }

        // 计算不确定度传���
        const mainExpr = expressions[expressions.length - 1];
        const parsedFormula = math.parse(mainExpr.split('=')[1]);
        let sumSquares = 0;
        
        // 显示不确定度传递计算过程
        const uncertaintyStep = document.createElement('div');
        uncertaintyStep.className = 'step';
        uncertaintyStep.innerHTML = '<h5>3. 不确定度传递计算</h5>';
        
        for (const [name, value] of Object.entries(variables)) {
            if (uncertainties[name]) {
                try {
                    const derivative = math.derivative(parsedFormula, name);
                    const contribution = math.evaluate(
                        `(${derivative.toString()})^2 * (${uncertainties[name]})^2`,
                        variables
                    );
                    sumSquares += contribution;
                    
                    uncertaintyStep.innerHTML += `
                        <div class="uncertainty-contribution">
                            <p>∂E/∂${name} = ${derivative.toString()}</p>
                            <p>${name}的不确定度贡献：${Math.sqrt(contribution).toFixed(6)}</p>
                        </div>
                    `;
                } catch (e) {
                    console.log(`跳过变量 ${name} 的不确定度计算: ${e.message}`);
                }
            }
        }
        calculationSteps.appendChild(uncertaintyStep);

        // 计算最终结果
        const uncertainty = Math.sqrt(sumSquares);
        const relativeUncertainty = (uncertainty / Math.abs(result)) * 100;
        const expandedUncertainty = 2 * uncertainty;
        const relativeExpandedUncertainty = 2 * relativeUncertainty;

        // 显示初步结果
        const resultStep = document.createElement('div');
        resultStep.className = 'step';
        resultStep.innerHTML = `
            <h5>4. 计算结果</h5>
            <p>计算值：${result.toFixed(6)} Pa</p>
            <p>标准不确定度：${uncertainty.toFixed(6)} Pa</p>
            <p>相对标准不确定度：${relativeUncertainty.toFixed(2)}%</p>
            <p>扩展不确定度(k=2)：${expandedUncertainty.toFixed(6)} Pa</p>
            <p>相对扩展不确定度：${relativeExpandedUncertainty.toFixed(2)}%</p>
        `;
        calculationSteps.appendChild(resultStep);

        // 添加修约过程
        const finalResult = RoundingRules.formatFinalResult(result, expandedUncertainty, 'Pa');
        const roundingStep = document.createElement('div');
        roundingStep.className = 'step';
        roundingStep.innerHTML = `
            <h5>5. 结果修约</h5>
            <div class="rounding-process">
                <p>修约规则：</p>
                <ol>
                    <li>不确定度修约为一位或两位有效数字：
                        <ul>
                            <li>当第一位数字为12时，保留两位有效数字</li>
                            <li>当第一位数字大于2时，保留一位有效数字</li>
                        </ul>
                    </li>
                    <li>测量结果的末位与不确定度的末位对齐</li>
                </ol>
                
                <p>修约过程：</p>
                <ol>
                    <li>原始不确定度：${expandedUncertainty.toFixed(6)} Pa</li>
                    <li>修约后的不确定度：${finalResult.uncertainty} Pa</li>
                    <li>原始测量值：${result.toFixed(6)} Pa</li>
                    <li>修约后的测量值：${finalResult.value} Pa</li>
                </ol>

                <p class="final-result">最终结果：${finalResult.formatted}</p>
                <p class="relative-uncertainty">相对扩展不确定度：${RoundingRules.roundToDecimalPlaces(relativeExpandedUncertainty, 1)}%</p>
            </div>
        `;
        calculationSteps.appendChild(roundingStep);

    } catch (error) {
        console.error('计算过程出错:', error);
        resultsContainer.innerHTML = `
            <p style="color: red;">计算错误：${error.message}</p>
            <p>请检查以下内容：</p>
            <ul>
                <li>所有变量是否已正确计算统计量</li>
                <li>公式格式是否正确（每个表达式用分号分隔）</li>
                <li>变量名是否与输入匹配</li>
                <li>数学运算符是否使用正确</li>
            </ul>
            <p>当前公式：</p>
            <pre>${formula}</pre>
            <p>当前变量：</p>
            <pre>${JSON.stringify(variables, null, 2)}</pre>
        `;
    }
}

// 不确定度类型切换处理
document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...

    // 添加不确定度类型切换事件监听
    document.querySelectorAll('input[name="uncertainty-type"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const typeA = document.getElementById('type-a-input');
            const typeB = document.getElementById('type-b-input');
            if (this.value === 'a') {
                typeA.style.display = 'block';
                typeB.style.display = 'none';
            } else {
                typeA.style.display = 'none';
                typeB.style.display = 'block';
            }
        });
    });
});

// 计算A类不确定度
function calculateTypeAUncertainty() {
    const dataText = document.getElementById('measurements').value;
    const data = dataText.split(/[,\s]+/).map(Number).filter(x => !isNaN(x));
    
    if (data.length < 2) {
        alert('A类不确定度需要至少2个数据点');
        return;
    }

    // 计算平均值
    const mean = data.reduce((a, b) => a + b) / data.length;
    
    // 计算标准差
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (data.length - 1);
    const standardDeviation = Math.sqrt(variance);
    
    // 计算标准不确定度
    const uncertainty = standardDeviation / Math.sqrt(data.length);
    
    // 计算相对不确定�������
    const relativeUncertainty = (uncertainty / Math.abs(mean)) * 100;

    // 显示结果
    document.getElementById('uncertainty-results').innerHTML = `
        <div class="result-item">
            <h4>A类不确定度计算结果</h4>
            <p>数据点数：${data.length}</p>
            <p>平均值：${mean.toFixed(6)}</p>
            <p>标准差：${standardDeviation.toFixed(6)}</p>
            <p>标准不确定度：${uncertainty.toFixed(6)}</p>
            <p>相对不确定度：${relativeUncertainty.toFixed(2)}%</p>
        </div>
    `;
}

// 计算B类不确定度
function calculateTypeBUncertainty() {
    const precision = parseFloat(document.getElementById('instrument-precision').value);
    const confidenceLevel = parseFloat(document.getElementById('confidence-level').value);
    
    if (isNaN(precision)) {
        alert('请输入有效的仪器精度值');
        return;
    }

    // 计算标准不确定度
    const uncertainty = precision / (Math.sqrt(3));
    
    // 显示结果
    document.getElementById('uncertainty-results').innerHTML = `
        <div class="result-item">
            <h4>B类不确定度计算结果</h4>
            <p>仪器精度：${precision}</p>
            <p>置信概率：${(confidenceLevel * 100).toFixed(2)}%</p>
            <p>标准不确定度：${uncertainty.toFixed(6)}</p>
        </div>
    `;
}

// ...existing code...

// 添加不确定度类型切换函数
function toggleUncertaintyType(type) {
    document.getElementById('type-a-input').style.display = type === 'a' ? 'block' : 'none';
    document.getElementById('type-b-input').style.display = type === 'b' ? 'block' : 'none';
}

// 计算A类不确定度
function calculateUncertaintyA() {
    const dataText = document.getElementById('measurements').value;
    const data = dataText.split(/[,\s]+/).map(Number).filter(x => !isNaN(x));
    
    if (data.length < 2) {
        alert('A类不确定度需要至少2个数据点');
        return;
    }

    // 计算��均值
    const mean = data.reduce((a, b) => a + b) / data.length;
    
    // 计算标准差
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (data.length - 1);
    const standardDeviation = Math.sqrt(variance);
    
    // 计算标准不确定度
    const uncertainty = standardDeviation / Math.sqrt(data.length);
    
    // 计算相对不确定度
    const relativeUncertainty = (uncertainty / Math.abs(mean)) * 100;

    // 显示结果
    document.getElementById('uncertainty-results').innerHTML = `
        <div class="result-item">
            <h4>A类不确定度计算结果</h4>
            <p>数据点数：${data.length}</p>
            <p>平均值：${mean.toFixed(6)}</p>
            <p>标准差：${standardDeviation.toFixed(6)}</p>
            <p>标准不确定度：${uncertainty.toFixed(6)}</p>
            <p>相对不确定度：${relativeUncertainty.toFixed(2)}%</p>
        </div>
    `;
}

// 计算B类不确定度
function calculateUncertaintyB() {
    const precision = parseFloat(document.getElementById('instrument-precision').value);
    const confidenceLevel = parseFloat(document.getElementById('confidence-level').value);
    
    if (isNaN(precision)) {
        alert('请输入有效的仪器精度值');
        return;
    }

    // 计算标准不确定度
    const uncertainty = precision / Math.sqrt(3);
    
    // 显示结果
    document.getElementById('uncertainty-results').innerHTML = `
        <div class="result-item">
            <h4>B类不确定度计算结果</h4>
            <p>仪器精度：${precision}</p>
            <p>置信概率：${(confidenceLevel * 100).toFixed(2)}%</p>
            <p>标准不确定度：${uncertainty.toFixed(6)}</p>
            <p>扩展不确定度(k=2)：${(2 * uncertainty).toFixed(6)}</p>
        </div>
    `;
}

// 添加到页面加载事件
document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
    
    // 初始化不确定度计算区域
    toggleUncertaintyType('a');
});

// ...existing code...

// 移除重复的 calculateTypeAUncertainty 和 calculateTypeBUncertainty 函数
// 保留 calculateUncertaintyA 和 calculateUncertaintyB 函数

// 移除重复的 calculateResult 函数定义，确保只有一个版本存在

// 合并多个 DOMContentLoaded 事��监听器
document.addEventListener('DOMContentLoaded', () => {
    // ...existing initialization code...

    // 添加自动范围切换事件监听
    const autoRangeCheckbox = document.getElementById('auto-range');
    if (autoRangeCheckbox) {
        autoRangeCheckbox.addEventListener('change', () => {
            document.querySelector('.axis-range').style.display = autoRangeCheckbox.checked ? 'none' : 'block';
        });
    }

    // 添加图表相关的事件监听器
    document.querySelectorAll('#show-error-bars, #auto-range').forEach(checkbox => {
        checkbox.addEventListener('change', updatePlot);
    });

    // 添加单位转换相关事件监听器
    document.getElementById('unit-type').addEventListener('change', updateUnitSelects);
    document.getElementById('from-unit').addEventListener('change', () => {});    document.getElementById('to-unit').addEventListener('change', () => {});    // 初始化不确定度计算区域    toggleUncertaintyType('a');    // 初始化示例数据加载    addVariable();});// ...existing code...// 保证 extractVariables 函数可供 UncertaintyAnalyzer 使用// 完善 UncertaintyAnalyzer 以计算不确定度const UncertaintyAnalyzer = {    calculateUncertainties(formula, scope) {        const variables = extractVariables(formula);        const uncertainties = {};        // 收集各变量的不确定度        variables.forEach(varName => {            const row = Array.from(document.getElementsByClassName('variable-row'))                .find(r => r.querySelector('.var-name').value === varName);            if (row && row.dataset.stats) {                const stats = JSON.parse(row.dataset.stats);                uncertainties[varName] = stats.uncertainty;            }        });        // 使用数学库计算偏导数并进行不确定度传播        const node = math.parse(formula.split('\n').pop()); // 获取最后一个表达式        const code = node.compile();        const result = code.evaluate(scope);        // 假设结果变量为 E        const partials = {};        variables.forEach(varName => {            partials[varName] = math.derivative(formula.split('\n').pop(), varName).evaluate(scope);        });        // 计算总不确定度        let totalUncertaintySquared = 0;        Object.keys(partials).forEach(varName => {            if (uncertainties[varName] !== undefined) {                totalUncertaintySquared += Math.pow(partials[varName] * uncertainties[varName], 2);            }        });        const totalUncertainty = Math.sqrt(totalUncertaintySquared);        return { E: totalUncertainty };    }}// 修��� calculateResult 函数以自动计算不确定度function calculateResult() {    const formula = document.getElementById('formula').value.trim();    const resultsContainer = document.getElementById('results-container');        if (!formula) {        resultsContainer.innerHTML = '<p class="error">请填写公式。</p>';        return;    }    try {        // 分割多个表达式        const expressions = formula.split(';');        const scope = {};        expressions.forEach(expr => {            if (expr.trim()) {                const node = math.parse(expr);                const code = node.compile();                const result = code.evaluate(scope);                // Store result in scope            }        });        // 计算不确定度        const uncertaintyResults = UncertaintyAnalyzer.calculateUncertainties(formula, scope);        // 显示结果        if (scope.E !== undefined) {            const E = RoundingRules.roundValue(scope.E, uncertaintyResults.E);            const uncertainty = RoundingRules.roundUncertainty(uncertaintyResults.E);            resultsContainer.innerHTML = `<p class="success">公式计算成功。E = ${E} ${getUnit('E')} ± ${uncertainty} ${getUnit('E')}</p>`;        } else {            resultsContainer.innerHTML = '<p class="error">计��成功，但未找到结果变量 E。</p>';        }    } catch (error) {        resultsContainer.innerHTML = `<p class="error">计算错误：${error.message}</p>`;    }}// ...existing code...function extractVariables(expr) {    // 移除所有空格和注释    const cleanFormula = expr.replace(/\/\/.*$/gm, '')  // 移除单行注释        .replace(/\/\*[\s\S]*?\*\//g, '')  // 移除多行注释        .replace(/\s+/g, '');  // 移除空格        // 替换 'π' 为 'pi'    const normalizedFormula = cleanFormula.replace(/π/g, 'pi');        // 移除常见数学函数名和常量    const noFunctions = normalizedFormula.replace(/sqrt|sin|cos|tan|exp|log|pi|e|abs/g, '');        // 移除数字（包括科学记数法）    const noNumbers = noFunctions.replace(/[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?/g, '');        // 移除数学运算符和括号    const noOperators = noNumbers.replace(/[+\-*/^()=,]/g, ' ');        // 匹配所有合法的变量名（字母开头，可包含字母、数字和下划线）    const matches = noOperators.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];        // 过滤掉数学常量和重复项    const constants = ['pi', 'e', 'i'];    const variables = [...new Set(matches)].filter(v => !constants.includes(v));        return variables;}// ...existing code...
// 验证变量名是否合法
function validateVariableName(input) {
    const varName = input.value.trim();
    const isValid = /^[a-zA-Z][a-zA-Z0-9_]*$/.test(varName);
    if (!isValid && varName !== '') {
        input.classList.add('error');
        input.title = '变量名必���以字母开头，且仅包含字母、数字和下划线';
    } else {
        input.classList.remove('error');
        input.title = '';
    }
}

// ...existing code...
