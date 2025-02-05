import React, { useState } from 'react';
import { Upload, Button, Table, Card, message, Space } from 'antd';
import { UploadOutlined, DownloadOutlined, ExportOutlined } from '@ant-design/icons';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import * as XLSX from 'xlsx';
import './App.css';

// 添加字段映射配置
const FIELD_MAPPING = {
  '税率': 'taxRate',
  '规格型号': 'spec',
  '金额': 'amount',
  '单价': 'price',
  '数量': 'quantity'
};

function App() {
  const [inputData, setInputData] = useState([]); // 进项数据
  const [outputData, setOutputData] = useState([]); // 销项数据
  const [analysis, setAnalysis] = useState([]); // 分析结果

  // 处理Excel文件上传
  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        
        if (workbook.SheetNames.length < 2) {
          message.error('Excel文件必须包含至少两个工作表');
          return;
        }

        // 读取sheet1（进项数据）
        const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
        const rawInputData = XLSX.utils.sheet_to_json(sheet1);
        const inputDataRaw = convertFieldNames(rawInputData);
        
        // 读取sheet2（销项数据）
        const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
        const rawOutputData = XLSX.utils.sheet_to_json(sheet2);
        const outputDataRaw = convertFieldNames(rawOutputData);

        // 验证数据格式
        if (!validateData(inputDataRaw) || !validateData(outputDataRaw)) {
          return;
        }

        setInputData(inputDataRaw);
        setOutputData(outputDataRaw);
        
        // 计算分析结果
        calculateAnalysis(inputDataRaw, outputDataRaw);
        message.success('数据导入成功');
      } catch (error) {
        message.error('文件处理失败：' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // 添加字段名转换函数
  const convertFieldNames = (data) => {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => {
      const convertedItem = {};
      Object.entries(item).forEach(([key, value]) => {
        const englishKey = FIELD_MAPPING[key];
        if (englishKey) {
          convertedItem[englishKey] = value;
        } else {
          convertedItem[key] = value;
        }
      });
      return convertedItem;
    });
  };

  // 计算分析结果
  const calculateAnalysis = (inputData, outputData) => {
    const results = [];
    
    // 按税率和规格型号分组
    const groupedInput = groupByTaxRateAndSpec(inputData);
    const groupedOutput = groupByTaxRateAndSpec(outputData);

    // 计算每组的利润率和差额
    for (const [key, inputGroup] of Object.entries(groupedInput)) {
      const outputGroup = groupedOutput[key] || [];
      
      const inputAmount = sumAmount(inputGroup);
      const outputAmount = sumAmount(outputGroup);
      const inputQuantity = sumQuantity(inputGroup);
      const outputQuantity = sumQuantity(outputGroup);
      
      // 计算利润率
      const profitRate = calculateProfitRate(
        inputAmount,
        inputQuantity,
        outputQuantity,
        getAveragePrice(inputGroup),
        getAveragePrice(outputGroup)
      );

      const [taxRate, spec] = key.split('-');
      results.push({
        taxRate,
        spec,
        inputQuantity,
        outputQuantity,
        quantityDiff: inputQuantity - outputQuantity,
        inputAmount,
        outputAmount,
        amountDiff: outputAmount - inputAmount,
        profitRate: (profitRate * 100).toFixed(2) + '%',
      });
    }
    

    setAnalysis(results);
  };

  // 修改 groupByTaxRateAndSpec 函数中的税率处理
  const groupByTaxRateAndSpec = (data) => {
    if (!Array.isArray(data)) {
      message.error('输入数据格式错误');
      return {};
    }

    return data.reduce((acc, item, index) => {
      // 数据验证
      if (!item.taxRate || !item.spec) {
        message.warning(`第 ${index + 1} 行数据缺少税率或规格型号`);
        return acc;
      }

      // 标准化字段名称和税率
      const rawTaxRate = String(item.taxRate).trim();
      // 修改税率转换逻辑
      let taxRate;
      if (rawTaxRate.includes('%')) {
        taxRate = parseFloat(rawTaxRate);
      } else {
        taxRate = parseFloat(rawTaxRate) * 100;
      }
      const spec = String(item.spec).trim();
      
      const key = `${taxRate}-${spec}`;
      
      if (!acc[key]) {
        acc[key] = [];
      }
      
      // 确保数值字段为数字类型
      const normalizedItem = {
        ...item,
        amount: Number(item.amount) || 0,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 0,
        taxRate,
        spec
      };
      
      acc[key].push(normalizedItem);
      return acc;
    }, {});
  };

  const sumAmount = (items) => items.reduce((sum, item) => sum + item.amount, 0);
  const sumQuantity = (items) => items.reduce((sum, item) => sum + item.quantity, 0);
  const getAveragePrice = (items) => {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const quantity = sumQuantity(items);
    return quantity ? total / quantity : 0;
  };

  const calculateProfitRate = (inputAmount, inputQty, outputQty, inputPrice, outputPrice) => {
    if (!inputAmount || !inputQty) return 0;
    return (inputAmount - (inputQty - outputQty) * inputPrice - outputQty * outputPrice) / (inputAmount * inputQty);
  };

  // 修改验证函数，添加中文提示
  const validateData = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
      message.error('数据格式错误或为空');
      return false;
    }

    const requiredFields = ['taxRate', 'spec', 'amount', 'price', 'quantity'];
    const fieldNamesChinese = {
      taxRate: '税率',
      spec: '规格型号',
      amount: '金额',
      price: '单价',
      quantity: '数量'
    };

    const missingFields = data.some((item, index) => {
      const missing = requiredFields.filter(field => !item.hasOwnProperty(field));
      if (missing.length > 0) {
        const missingChinese = missing.map(field => fieldNamesChinese[field]).join(', ');
        message.error(`第 ${index + 1} 行缺少必要字段: ${missingChinese}`);
        return true;
      }
      return false;
    });

    return !missingFields;
  };

  // 修改税率到产品品类的映射函数
  const getTaxRateCategory = (taxRate) => {
    // 将税率统一转换为数字
    const rate = parseFloat(taxRate);
    
    // 处理近似值比较
    if (Math.abs(rate - 9) < 0.1) return '颗粒(9%)';
    if (Math.abs(rate - 13) < 0.1) return '溶液(13%)';
    return `未知品类(${rate}%)`;
  };

  // 修改表格列定义
  const columns = [
    { 
      title: '产品品类', 
      dataIndex: 'taxRate', 
      key: 'taxRate',
      sorter: (a, b) => Number(a.taxRate) - Number(b.taxRate),
      sortDirections: ['descend', 'ascend'],
      render: (taxRate) => getTaxRateCategory(taxRate)
    },
    { 
      title: '规格型号', 
      dataIndex: 'spec', 
      key: 'spec',
      sorter: (a, b) => a.spec.localeCompare(b.spec),
      sortDirections: ['descend', 'ascend']
    },
    { 
      title: '进项数量', 
      dataIndex: 'inputQuantity', 
      key: 'inputQuantity',
      sorter: (a, b) => a.inputQuantity - b.inputQuantity,
      sortDirections: ['descend', 'ascend'],
      render: (value) => value.toFixed(2)
    },
    { 
      title: '销项数量', 
      dataIndex: 'outputQuantity', 
      key: 'outputQuantity',
      sorter: (a, b) => a.outputQuantity - b.outputQuantity,
      sortDirections: ['descend', 'ascend'],
      render: (value) => value.toFixed(2)
    },
    { 
      title: '数量差额', 
      dataIndex: 'quantityDiff', 
      key: 'quantityDiff',
      sorter: (a, b) => a.quantityDiff - b.quantityDiff,
      sortDirections: ['descend', 'ascend'],
      render: (value) => value.toFixed(2)
    },
    { 
      title: '进项金额', 
      dataIndex: 'inputAmount', 
      key: 'inputAmount',
      sorter: (a, b) => a.inputAmount - b.inputAmount,
      sortDirections: ['descend', 'ascend'],
      render: (value) => value.toFixed(2)
    },
    { 
      title: '销项金额', 
      dataIndex: 'outputAmount', 
      key: 'outputAmount',
      sorter: (a, b) => a.outputAmount - b.outputAmount,
      sortDirections: ['descend', 'ascend'],
      render: (value) => value.toFixed(2)
    },
    { 
      title: '金额差额', 
      dataIndex: 'amountDiff', 
      key: 'amountDiff',
      sorter: (a, b) => a.amountDiff - b.amountDiff,
      sortDirections: ['descend', 'ascend'],
      render: (value) => value.toFixed(2)
    },
    { 
      title: '利润率', 
      dataIndex: 'profitRate', 
      key: 'profitRate',
      sorter: (a, b) => parseFloat(a.profitRate) - parseFloat(b.profitRate),
      sortDirections: ['descend', 'ascend']
    }
  ];

  // 下载模板
  const downloadTemplate = () => {
    // 创建模板数据
    const template = {
      '进项数据': [
        {
          '税率': '9%',
          '规格型号': '25kg',
          '金额': '',
          '单价': '',
          '数量': ''
        }
      ],
      '销项数据': [
        {
          '税率': '9%',
          '规格型号': '25kg',
          '金额': '',
          '单价': '',
          '数量': ''
        }
      ]
    };

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    
    // 添加进项数据工作表
    const ws1 = XLSX.utils.json_to_sheet(template['进项数据']);
    XLSX.utils.book_append_sheet(wb, ws1, '进项数据');
    
    // 添加销项数据工作表
    const ws2 = XLSX.utils.json_to_sheet(template['销项数据']);
    XLSX.utils.book_append_sheet(wb, ws2, '销项数据');
    
    // 下载文件
    XLSX.writeFile(wb, '进销项数据模板.xlsx');
  };

  // 导出分析结果
  const exportAnalysis = () => {
    if (analysis.length === 0) {
      message.warning('暂无数据可导出');
      return;
    }

    // 转换数据格式
    const exportData = analysis.map(item => ({
      '产品品类': getTaxRateCategory(item.taxRate),
      '规格型号': item.spec,
      '进项数量': Number(item.inputQuantity).toFixed(2),
      '销项数量': Number(item.outputQuantity).toFixed(2),
      '数量差额': Number(item.quantityDiff).toFixed(2),
      '进项金额': Number(item.inputAmount).toFixed(2),
      '销项金额': Number(item.outputAmount).toFixed(2),
      '金额差额': Number(item.amountDiff).toFixed(2),
      '利润率': item.profitRate
    }));

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // 更新列宽
    const colWidths = [
      { wch: 15 }, // 产品品类
      { wch: 12 }, // 规格型号
      { wch: 12 }, // 进项数量
      { wch: 12 }, // 销项数量
      { wch: 12 }, // 数量差额
      { wch: 12 }, // 进项金额
      { wch: 12 }, // 销项金额
      { wch: 12 }, // 金额差额
      { wch: 10 }  // 利润率
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, '分析结果');
    XLSX.writeFile(wb, '进销项数据分析结果.xlsx');
  };

  return (
    <div className="app-container">
      <Card title="进销项数据分析">
        <Space size="middle">
          <Button 
            icon={<DownloadOutlined />} 
            onClick={downloadTemplate}
          >
            下载模板
          </Button>
          <Upload
            accept=".xlsx,.xls"
            beforeUpload={handleFileUpload}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>上传Excel文件</Button>
          </Upload>
          <Button 
            icon={<ExportOutlined />} 
            onClick={exportAnalysis}
            disabled={analysis.length === 0}
          >
            导出分析结果
          </Button>
        </Space>
        
        {analysis.length > 0 && (
          <div className="analysis-table">
            <h2>分析结果</h2>
            <Table 
              columns={columns} 
              dataSource={analysis} 
              rowKey={(record) => `${record.taxRate}-${record.spec}`}
              pagination={false}
            />

            {/* 金额对比折线图 */}
            <Card title="金额对比" className="chart-card">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={analysis.map(item => ({
                    category: `${getTaxRateCategory(item.taxRate)}-${item.spec}`,
                    进项金额: item.inputAmount,
                    销项金额: item.outputAmount,
                    进销差额: item.amountDiff
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toFixed(2)} />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    wrapperStyle={{ paddingBottom: 10 }}
                  />
                  <Line type="monotone" dataKey="进项金额" stroke="#8884d8" />
                  <Line type="monotone" dataKey="销项金额" stroke="#82ca9d" />
                  <Line type="monotone" dataKey="进销差额" stroke="#ffc658" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* 数量对比折线图 */}
            <Card title="数量对比" className="chart-card">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={analysis.map(item => ({
                    category: `${getTaxRateCategory(item.taxRate)}-${item.spec}`,
                    进项数量: item.inputQuantity,
                    销项数量: item.outputQuantity,
                    数量差额: item.quantityDiff
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toFixed(2)} />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    wrapperStyle={{ paddingBottom: 10 }}
                  />
                  <Line type="monotone" dataKey="进项数量" stroke="#8884d8" />
                  <Line type="monotone" dataKey="销项数量" stroke="#82ca9d" />
                  <Line type="monotone" dataKey="数量差额" stroke="#ffc658" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* 利润率柱状图 */}
            <Card title="利润率分析" className="chart-card">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={analysis.map(item => ({
                    category: `${getTaxRateCategory(item.taxRate)}-${item.spec}`,
                    利润率: parseFloat(item.profitRate)
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    wrapperStyle={{ paddingBottom: 10 }}
                  />
                  <Bar dataKey="利润率" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
}

export default App;
