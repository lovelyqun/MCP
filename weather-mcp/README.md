# 创建你的第一个MCP服务

## Model Context Protocol (MCP) 中国天气查询服务创建教程

## 什么是 Model Context Protocol (MCP)

Model Context Protocol (MCP) 是一种开放标准协议，允许大型语言模型（LLM）如 Claude 与外部系统和数据源进行交互。通过 MCP，Claude 可以：

- 访问实时信息和数据
- 执行特定的计算和操作
- 调用专业工具和 API
- 为用户提供更准确、更及时的回答

MCP 赋予 AI 以"工具使用"能力，使其突破固有知识库的限制，能够获取最新信息并执行具体任务，大大提升了 AI 的实用性。

## MCP 的工作原理

MCP 的核心是一套简单但强大的通信协议：

1. **工具注册**：开发者定义工具，描述其功能和参数
2. **工具调用**：Claude 确定需要使用工具并发出请求
3. **工具执行**：MCP 服务器接收请求，执行操作，返回结果
4. **结果解析**：Claude 解析结果并将其整合到回答中

整个过程对用户来说是无缝的，用户只需提出问题，MCP 在后台自动处理工具调用。

## 创建中国天气查询 MCP 服务教程

下面我们将一步一步创建一个中国天气查询 MCP 服务。

### 第一步：环境准备

首先，确保你的系统安装了 Node.js 和 npm。然后创建项目：

```bash
mkdir weather-mcp
cd weather-mcp
npm init -y
```

### 第二步：安装依赖

编辑 package.json 文件，添加必要的依赖：

```json
{
  "name": "weather-mcp-node",
  "version": "1.0.0",
  "description": "基于Node.js的中国天气查询MCP服务",
  "main": "weather.js",
  "type": "module",
  "scripts": {
    "start": "node weather.js",
    "test:weather": "echo '{\"name\":\"get_china_weather\",\"parameters\":{\"city\":\"北京\"}}' | node weather.js"
  },
  "keywords": ["mcp", "weather", "claude", "china"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.11.2",
    "moment": "^2.30.1",
    "zod": "^3.22.4"
  }
}
```

然后安装依赖：

```bash
npm install
```

### 第三步：实现 MCP 服务

创建 weather.js 文件，作为我们的主程序：

```javascript
// 导入所需模块
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import moment from 'moment';
import { z } from 'zod';

// 提供的城市和省份映射（简化版，实际可以包含更多城市）
const CITY_PROVINCE = {
  "北京": "北京市",
  "上海": "上海市",
  "广州": "广东省",
  "深圳": "广东省",
  "杭州": "浙江省",
  "南京": "江苏省"
};

// 城市地理信息（经纬度）
const CITY_LOCATIONS = {
  "北京": {"lat": 39.9042, "lon": 116.4074},
  "上海": {"lat": 31.2304, "lon": 121.4737},
  "广州": {"lat": 23.1291, "lon": 113.2644},
  "深圳": {"lat": 22.5431, "lon": 114.0579},
  "杭州": {"lat": 30.2741, "lon": 120.1551},
  "南京": {"lat": 32.0584, "lon": 118.7965}
};

// 初始化MCP服务器
const server = new McpServer({
  name: "china_weather",
  version: "1.0.0",
  capabilities: {
    tools: {}
  }
});

// 辅助函数：获取当前季节
function getSeason() {
  const month = moment().month() + 1;
  if ([3, 4, 5].includes(month)) return "春季";
  else if ([6, 7, 8].includes(month)) return "夏季";
  else if ([9, 10, 11].includes(month)) return "秋季";
  else return "冬季";
}

// 辅助函数：生成随机整数
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 为城市生成模拟天气数据
function generateWeatherData(city) {
  if (!CITY_PROVINCE[city]) return null;
  
  const season = getSeason();
  const today = moment();
  const forecastData = [];
  
  // 根据季节设定温度范围
  let tempRange;
  switch (season) {
    case "春季": tempRange = [15, 25]; break;
    case "夏季": tempRange = [25, 35]; break;
    case "秋季": tempRange = [15, 25]; break;
    case "冬季": tempRange = [0, 15]; break;
  }
  
  // 设定可能的天气类型
  const weatherTypes = ["晴", "多云", "小雨", "阴"];
  
  // 生成5天的天气数据
  for (let i = 0; i < 5; i++) {
    const date = moment(today).add(i, 'days');
    const dateStr = date.format('YYYY-MM-DD');
    const weekDay = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][date.day()];
    
    const weatherType = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
    const tempHigh = getRandomInt(tempRange[0], tempRange[1]);
    const tempLow = getRandomInt(tempRange[0], tempHigh - 2);
    
    forecastData.push({
      date: dateStr,
      week: weekDay,
      weather: weatherType,
      temp_day: tempHigh,
      temp_night: tempLow,
      wind_direction: "东南风",
      wind_power: `${getRandomInt(1, 5)}级`
    });
  }
  
  return {
    city: city,
    province: CITY_PROVINCE[city],
    data: forecastData
  };
}

// 将天气数据格式化为可读字符串
function formatChinaWeather(data) {
  if (!data) return "无法获取天气数据。";
  
  const city = data.city || "未知城市";
  const province = data.province || "";
  const forecasts = [];
  
  for (const day of data.data) {
    const dayInfo = `
日期: ${day.date} ${day.week}
天气: ${day.weather}
温度: ${day.temp_day}°C ~ ${day.temp_night}°C
风力: ${day.wind_direction} ${day.wind_power}
`;
    forecasts.push(dayInfo);
  }
  
  const header = province ? `📍 ${province} ${city}` : `📍 ${city}`;
  return `${header}\n\n` + forecasts.join("\n---\n");
}

// 注册天气查询工具
server.tool(
  "get_china_weather",
  "查询中国城市的天气预报。",
  {
    city: z.string().describe('中国城市名称（例如"北京"、"上海"、"广州"）')
  },
  async ({ city }) => {
    const weatherData = generateWeatherData(city);
    
    if (!weatherData) {
      return {
        content: [{
          type: "text",
          text: `无法获取${city}的天气信息。请提供准确的中国城市名称（如北京、上海、广州等）。`
        }]
      };
    }
    
    const result = formatChinaWeather(weatherData);
    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  }
);

// 注册城市信息查询工具
server.tool(
  "get_china_city_info",
  "获取中国城市的基本信息和地理位置。",
  {
    city: z.string().describe('中国城市名称（例如"北京"、"上海"、"广州"）')
  },
  async ({ city }) => {
    if (!CITY_PROVINCE[city]) {
      return {
        content: [{
          type: "text",
          text: `未找到城市：${city}。请提供准确的中国城市名称（如北京、上海、广州等）。`
        }]
      };
    }
    
    const province = CITY_PROVINCE[city];
    const location = CITY_LOCATIONS[city];
    
    const result = `
📍 ${city}
所在地区: ${province}
经度: ${location.lon}
纬度: ${location.lat}
`;
    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  }
);

// 运行服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("中国天气MCP服务器已启动，使用stdio传输...");
}

main().catch(error => {
  console.error("服务器运行错误:", error);
  process.exit(1);
});
```

### 第四步：创建配置文件

为了在 Cursor 或 Claude Desktop 中使用，创建一个 config-example.json 文件：

```json
{
  "mcpServers": {
    "china_weather": {
      "command": "npm",
      "args": [
        "start",
        "--prefix",
        "/Users/你的用户名/路径/到/weather-mcp"
      ],
      "env": {}
    }
  }
}
```

### 第五步：测试服务

运行服务进行测试：

```bash
npm start
```

或使用预定义的测试命令：

```bash
npm run test:weather
```

### 第六步：与 Cursor 集成

1. 打开 Cursor 应用
2. 进入设置 (Settings)
3. 找到 MCP 设置部分
4. 添加新的 MCP 服务，名称为 "china_weather"
5. 设置命令为: `npm start --prefix /你的完整路径/weather-mcp`
6. 保存设置

### 第七步：使用 MCP 工具

在 Cursor 中，可以直接调用天气查询工具：

```
请问今天北京的天气怎么样？
```

Claude 会自动调用我们的 MCP 服务，并返回格式化的天气信息。

## MCP 设计最佳实践

创建高质量的 MCP 服务，应当遵循以下最佳实践：

1. **简洁明了的工具描述**：确保描述清晰表达工具的功能和用途
2. **严格的参数验证**：使用 zod 等库验证输入参数
3. **友好的错误处理**：提供有意义的错误信息
4. **合理的功能拆分**：每个工具只做一件事，功能不要过于复杂
5. **优雅的响应格式**：返回结构化且易读的数据
6. **高效的执行性能**：避免不必要的延迟
7. **良好的文档**：提供详细的安装和使用说明

## 扩展和优化

可以考虑对天气服务进行以下扩展：

1. 接入真实的天气 API（如和风天气、高德天气等）
2. 增加更多功能，如空气质量指数查询
3. 支持更多城市和地区
4. 添加历史天气数据查询
5. 增加可视化内容（如天气图标）

## 结语

MCP 为 AI 提供了与外部世界交互的能力，大大拓展了 Claude 等大型语言模型的应用场景。通过本教程，你不仅学会了如何创建一个基本的 MCP 服务，还了解了 MCP 的工作原理和设计理念。

希望这个中国天气查询服务能为你提供实用的功能，同时也作为你开发更多 MCP 工具的起点。随着 MCP 生态的不断发展，我们期待看到更多创新的应用出现。
