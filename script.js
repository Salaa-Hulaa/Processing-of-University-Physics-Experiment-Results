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

// 计算结果函数
function calculateResult() {
    const formula = document.getElementById('formula').value;
    const resultsContainer = document.getElementById('results-container');
    
    try {
        // 首先创建计算步骤容器
        resultsContainer.innerHTML = '<div class="calculation-steps"><h4>计算过程</h4></div>';
        const calculationSteps = resultsContainer.querySelector('.calculation-steps');

        // 收集变量数据和计算过程
        const variables = {};
        const uncertainties = {};
        const variablesStep = document.createElement('div');
        variablesStep.className = 'step';
        variablesStep.innerHTML = '<h5>1. 变量值及其不确定度</h5>';
        
        document.querySelectorAll('.variable-row').forEach(row => {
            const name = row.querySelector('.var-name').value;
            const stats = JSON.parse(row.dataset.stats || '{}');
            if (stats.mean !== undefined) {
                variables[name] = stats.mean;
                uncertainties[name] = stats.uncertainty;
                variablesStep.innerHTML += `
                    <div class="variable-value">
                        <p>${name} = ${stats.mean.toFixed(6)} ± ${stats.uncertainty.toFixed(6)}</p>
                        <p>相对不确定度：${((stats.uncertainty/Math.abs(stats.mean))*100).toFixed(2)}%</p>
                    </div>
                `;
            }
        });
        calculationSteps.appendChild(variablesStep);

        // 添加常量
        variables['pi'] = Math.PI;

        // 显示计算公式
        const formulaStep = document.createElement('div');
        formulaStep.className = 'step';
        formulaStep.innerHTML = `
            <h5>2. 计算公式</h5>
            <p class="formula">${formula}</p>
        `;
        calculationSteps.appendChild(formulaStep);

        // 分割多个表达式
        const expressions = formula.split(';').map(expr => expr.trim());
        
        // 依次执行每个表达式
        let result;
        expressions.forEach(expr => {
            if (expr) {
                result = math.evaluate(expr, variables);
                const assignMatch = expr.match(/(\w+)\s*=/);
                if (assignMatch) {
                    variables[assignMatch[1]] = result;
                }
            }
        });

        // 计算不确定度传递
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
                            <li>当第一位数字为1或2时，保留两位有效数字</li>
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
        resultsContainer.innerHTML = `
            <p style="color: red;">计算错误：${error.message}</p>
            <p>请检查公式格式是否正确，确保：</p>
            <ul>
                <li>每个表达式用分号(;)分隔</li>
                <li>变量名合法且已定义</li>
                <li>数学运算符使用正确</li>
            </ul>
        `;
    }
}

// 添加示例数据加载函数
function loadExample() {
    // 清除现有变量
    document.getElementById('variables-container').innerHTML = '';
    
    // 添加各个变量
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

    // 创建变量输入行并填充数据
    variables.forEach(v => {
        const varDiv = document.createElement('div');
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
        
        // 自动计算统计量
        setTimeout(() => {
            calculateVariableStats(varDiv.querySelector('.variable-actions button:last-child'));
        }, 100);
    });

    // 更新变量选择下拉框
    updateVariableSelects();

    // 添加计算公式
    const formulaInput = document.getElementById('formula');
    if (formulaInput) {
        formulaInput.value = `
            // 单位转换
            L_m = L/1000;    // mm -> m
            d_m = d/1000;    // mm -> m
            D_m = D/1000;    // mm -> m
            
            // 杨氏模量计算
            E = (4 * m * 9.794 * L_m^3)/(pi * d_m^2 * D_m^2)
        `.trim();
    }

    // 添加实验分析说明
    const analysisDiv = document.createElement('div');
    analysisDiv.className = 'analysis-section';
    analysisDiv.innerHTML = `
        <h4>杨氏模量计算与不确定度分析</h4>
        <div class="analysis-content">
            <div class="calculation-step">
                <h5>1. 基本公式</h5>
                <p class="formula">E = (4mgL³)/(πd²D²)</p>
                <p>其中：</p>
                <ul>
                    <li>E - 杨氏模量 (Pa)</li>
                    <li>m - 砝码质量 (kg)</li>
                    <li>g - 重力加速度 (9.794 m/s²)</li>
                    <li>L - 金属丝长度 (m)</li>
                    <li>d - 金属丝直径 (m)</li>
                    <li>D - 圆筒直径 (m)</li>
                </ul>
            </div>

            <div class="calculation-step">
                <h5>2. 不确定度传递</h5>
                <p>根据不确定度传递公式：</p>
                <p class="formula">
                    (ΔE/E)² = (Δm/m)² + (3ΔL/L)² + (4Δd/d)² + (4ΔD/D)²
                </p>
                <p>各项说明：</p>
                <ul>
                    <li>(Δm/m)² - 质量的相对不确定度贡献</li>
                    <li>(3ΔL/L)² - 长度的相对不确定度贡献（三次方导致系数为3）</li>
                    <li>(4Δd/d)² - 金属丝直径的相对不确定度贡献（平方导致系数为4）</li>
                    <li>(4ΔD/D)² - 圆筒直径的相对不确定度贡献（平方导致系数为4）</li>
                </ul>
            </div>

            <div class="calculation-step">
                <h5>3. 计算步骤</h5>
                <ol>
                    <li>将所有长度单位从mm转换为m</li>
                    <li>计算各变量的相对不确定度</li>
                    <li>代入不确定度传递公式计算总的相对不确定度</li>
                    <li>计算杨氏模量E及其不确定度ΔE</li>
                    <li>根据修约规则得到最终结果</li>
                </ol>
            </div>
        </div>
    `;
    
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.appendChild(analysisDiv);
    }

    // 自动计算结果
    setTimeout(calculateResult, 200);
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
                // 线性拟合
                const { slope, intercept, correlation } = linearFit(xData, yData);
                
                // 生成拟合线数据点
                const xFit = [Math.min(...xData), Math.max(...xData)];
                const yFit = xFit.map(x => slope * x + intercept);

                const fitTrace = {
                    x: xFit,
                    y: yFit,
                    mode: 'lines',
                    type: 'scatter',
                    name: `拟合线: ${yVar} = (${slope.toFixed(4)})${xVar} + (${intercept.toFixed(4)})`,
                    line: { color: 'red' }
                };
                traces.push(fitTrace);

                // 存储拟合参数供后续使用
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
    
    // 移除常见数学函数名和常量
    const noFunctions = cleanFormula.replace(/sqrt|sin|cos|tan|exp|log|pi|e|abs/g, '');
    
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
            throw new Error('最后一个表达式必须是赋值形式（例如：E = ...）');
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