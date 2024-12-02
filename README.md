# 物理实验数据处理系统

一个专门用于物理实验数据处理的Web应用，支持数据统计、不确定度计算、数据拟合和图表可视化等功能。

## 功能特点

### 1. 数据输入与管理
- 支持多变量输入和管理
- 支持多组数据批量输入（逗号或空格分隔）
- 自动识别A类和B类不确定度
- 支持国际单位制（SI）及其常用单位

### 2. 统计计算
- 自动计算平均值、标准差
- A类不确定度：多次测量的标准偏差
- B类不确定度：仪器精度的不确定度
- 支持扩展不确定度计算（k=2）

### 3. 数据拟合
- 支持线性最小二乘拟合
- 自动计算相关系数
- 提供拟合参数及其不确定度
- 可视化拟合结果

### 4. 图表功能
- 数据点显示
- 误差棒显示
- 拟合曲线绘制
- 支持多曲线对比
- 交互式缩放和平移
- 自定义坐标轴范围

### 5. 不确定度分析
- 自动推导不确定度传递公式
- 计算偏导数
- 合成标准不确定度计算
- 相对不确定度计算
- 扩展不确定度计算

### 6. 结果修约
- 符合物理实验规范的修约规则
- 自动判断有效数字
- 科学记数法支持
- 标准的结果表示格式

## 使用说明

### 1. 基本操作
1. 添加变量：
   - 点击"添加变量"按钮
   - 输入变量名、数据、精度和单位
   - 选择不确定度类型（A类/B类）

2. 数据处理：
   - 点击"计算统计量"获取基本统计信息
   - 系统自动计算平均值、标准差和不确定度

3. 数据拟合：
   - 在"数据可视化"区域添加曲线
   - 选择X轴和Y轴变量
   - 可选择是否显示误差棒和拟合线

4. 公式计算：
   - 输入计算公式
   - 支持多步骤计算（用分号分隔）
   - 自动生成不确定度传递公式

### 2. 示例：杨氏模量测量
系统内置了杨氏模量测量实验的示例，展示了完整的数据处理流程：
1. 数据输入：砝码质量、形变量等
2. 单位转换：mm到m的转换
3. 不确定度计算：考虑各测量量的不确定度
4. 数据拟合：质量-形变关系的线性拟合
5. 结果计算：杨氏模量的最终结果

### 3. 高级功能
1. 图表操作：
   - 缩放：使用鼠标滚轮
   - 平移：点击并拖动
   - 范围调整：手动输入或自动
   - 添加标注：使用工具栏

2. 不确定度分析：
   - 自动推导偏导数
   - 生成完整的传递公式
   - 计算各变量的贡献

3. 结果修约：
   - 自动判断有效数字
   - 根据不确定度确定小数位数
   - 标准的结果表示

## 技术细节

### 1. 使用的库
- math.js：数学计算和符号运算
- Plotly.js：图表绘制和交互
- 原生JavaScript：核心功能实现

### 2. 数据处理算法
1. 统计计算：
   - 平均值：算术平均
   - 标准差：贝塞尔公式
   - A类不确定度：标准差/√n
   - B类不确定度：仪器精度/√3

2. 拟合算法：
   - 最小二乘法
   - 加权最小二乘（考虑误差）
   - 相关系数计算

3. 不确定度传递：
   - 偏导数计算
   - 合成标准不确定度
   - 扩展不确定度（k=2）

### 3. 修约规则
1. 不确定度修约：
   - 第一位是1-2保留两位
   - 第一位是3-9保留一位

2. 测量结果修约：
   - 末位与不确定度对齐
   - 必要时使用科学记数法

## 注意事项

1. 数据输入：
   - 确保数据格式正确
   - 注意单位一致性
   - 合理选择不确定度类型

2. 公式输入：
   - 使用正确的数学运算符
   - 多步骤计算用分号分隔
   - 变量名要与输入匹配

3. 结果解释：
   - 注意单位换算
   - 检查结果合理性
   - 理解不确定度来源

## 未来改进

1. 功能扩展：
   - 支持更多拟合模型
   - 添加数据导入导出
   - 支持更多单位换算

2. 界面优化：
   - 响应式设计改进
   - 更多交互功能
   - 多语言支持

3. 计算能力：
   - 支持更复杂的公式
   - 添加更多统计方法
   - 优化计算性能 