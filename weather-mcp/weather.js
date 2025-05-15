// 导入所需模块
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import moment from 'moment';
import { z } from 'zod';

// 提供的城市和省份映射
const CITY_PROVINCE = {
  "北京": "北京市",
  "上海": "上海市",
  "广州": "广东省",
  "深圳": "广东省",
  "杭州": "浙江省",
  "南京": "江苏省",
  "苏州": "江苏省",
  "成都": "四川省",
  "重庆": "重庆市",
  "武汉": "湖北省",
  "西安": "陕西省",
  "天津": "天津市",
  "长沙": "湖南省",
  "济南": "山东省",
  "青岛": "山东省",
  "大连": "辽宁省",
  "宁波": "浙江省",
  "厦门": "福建省",
  "福州": "福建省",
  "哈尔滨": "黑龙江省",
  "沈阳": "辽宁省",
  "长春": "吉林省",
  "郑州": "河南省",
  "太原": "山西省",
  "石家庄": "河北省",
  "合肥": "安徽省",
  "昆明": "云南省",
  "南宁": "广西壮族自治区",
  "贵阳": "贵州省",
  "海口": "海南省",
  "乌鲁木齐": "新疆维吾尔自治区",
  "拉萨": "西藏自治区",
  "兰州": "甘肃省",
  "西宁": "青海省",
  "银川": "宁夏回族自治区",
  "呼和浩特": "内蒙古自治区"
};

// 天气类型列表
const WEATHER_TYPES = ["晴", "多云", "阴", "小雨", "中雨", "大雨", "雷阵雨", "小雪", "中雪", "大雪", "雾", "霾"];

// 风向列表
const WIND_DIRECTIONS = ["东风", "西风", "南风", "北风", "东北风", "西北风", "东南风", "西南风"];

// 城市地理信息（经纬度）
const CITY_LOCATIONS = {
  "北京": {"lat": 39.9042, "lon": 116.4074},
  "上海": {"lat": 31.2304, "lon": 121.4737},
  "广州": {"lat": 23.1291, "lon": 113.2644},
  "深圳": {"lat": 22.5431, "lon": 114.0579},
  "杭州": {"lat": 30.2741, "lon": 120.1551},
  "南京": {"lat": 32.0584, "lon": 118.7965},
  "苏州": {"lat": 31.2989, "lon": 120.5853},
  "成都": {"lat": 30.5728, "lon": 104.0668},
  "重庆": {"lat": 29.5633, "lon": 106.5530},
  "武汉": {"lat": 30.5928, "lon": 114.3055},
  "西安": {"lat": 34.3416, "lon": 108.9398},
  "天津": {"lat": 39.0842, "lon": 117.2009},
  "长沙": {"lat": 28.1990, "lon": 112.9663},
  "济南": {"lat": 36.6683, "lon": 117.0206},
  "青岛": {"lat": 36.0671, "lon": 120.3826},
  "大连": {"lat": 38.9140, "lon": 121.6147},
  "宁波": {"lat": 29.8683, "lon": 121.5440},
  "厦门": {"lat": 24.4798, "lon": 118.0894},
  "福州": {"lat": 26.0745, "lon": 119.2965},
  "哈尔滨": {"lat": 45.8038, "lon": 126.5340},
  "沈阳": {"lat": 41.8057, "lon": 123.4315},
  "长春": {"lat": 43.8170, "lon": 125.3240},
  "郑州": {"lat": 34.7466, "lon": 113.6253},
  "太原": {"lat": 37.8706, "lon": 112.5489},
  "石家庄": {"lat": 38.0428, "lon": 114.5149},
  "合肥": {"lat": 31.8612, "lon": 117.2830},
  "昆明": {"lat": 25.0389, "lon": 102.7181},
  "南宁": {"lat": 22.8170, "lon": 108.3669},
  "贵阳": {"lat": 26.6470, "lon": 106.6302},
  "海口": {"lat": 20.0442, "lon": 110.1995},
  "乌鲁木齐": {"lat": 43.8256, "lon": 87.6168},
  "拉萨": {"lat": 29.6500, "lon": 91.1000},
  "兰州": {"lat": 36.0611, "lon": 103.8343},
  "西宁": {"lat": 36.6232, "lon": 101.7782},
  "银川": {"lat": 38.4872, "lon": 106.2309},
  "呼和浩特": {"lat": 40.8424, "lon": 111.7490}
};

// 初始化FastMCP服务器
const server = new McpServer({
  name: "china_weather",
  version: "1.0.0",
  capabilities: {
    tools: {}
  }
});

/**
 * 根据当前日期获取季节
 * @returns {string} 季节名称
 */
function getSeason() {
  const month = moment().month() + 1; // 月份从0开始，需要+1
  
  if ([3, 4, 5].includes(month)) {
    return "春季";
  } else if ([6, 7, 8].includes(month)) {
    return "夏季";
  } else if ([9, 10, 11].includes(month)) {
    return "秋季";
  } else {
    return "冬季";
  }
}

/**
 * 根据城市和季节生成合理的温度范围
 * @param {string} city 城市名称
 * @param {string} season 季节
 * @returns {Array} 温度范围对象，包含最低和最高温度
 */
function getTemperatureRange(city, season) {
  const seasonRanges = {
    "北方城市": {
      "春季": [10, 25],
      "夏季": [22, 35],
      "秋季": [10, 25],
      "冬季": [-10, 10]
    },
    "南方城市": {
      "春季": [15, 28],
      "夏季": [25, 38],
      "秋季": [15, 28],
      "冬季": [0, 15]
    }
  };
  
  // 简单区分南北方城市
  const northCities = ["北京", "天津", "石家庄", "太原", "呼和浩特", "沈阳", "长春", "哈尔滨", "济南", "郑州", "西安", "兰州", "西宁", "银川", "乌鲁木齐"];
  
  const regionType = northCities.includes(city) ? "北方城市" : "南方城市";
  const tempRange = seasonRanges[regionType][season];
  
  return tempRange;
}

/**
 * 生成一个指定范围内的随机整数
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {number} 随机整数
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 为城市生成模拟天气数据
 * @param {string} city 城市名称
 * @returns {Object|null} 天气数据对象，如果城市不存在则返回null
 */
function generateWeatherData(city) {
  if (!CITY_PROVINCE[city]) {
    return null;
  }
  
  const season = getSeason();
  const tempRange = getTemperatureRange(city, season);
  
  // 基于季节选择更可能的天气类型
  const seasonWeather = {
    "春季": ["晴", "多云", "小雨", "阴", "雷阵雨"],
    "夏季": ["晴", "多云", "雷阵雨", "大雨", "中雨"],
    "秋季": ["晴", "多云", "小雨", "阴"],
    "冬季": ["晴", "多云", "阴", "小雪", "中雪"]
  };
  
  // 生成5天的天气数据
  const today = moment();
  const forecastData = [];
  
  for (let i = 0; i < 5; i++) {
    const date = moment(today).add(i, 'days');
    const dateStr = date.format('YYYY-MM-DD');
    const weekDay = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][date.day() - 1 >= 0 ? date.day() - 1 : 6];
    
    // 生成天气
    const weatherIndex = Math.floor(Math.random() * seasonWeather[season].length);
    const weatherType = seasonWeather[season][weatherIndex];
    
    // 生成温度（保持一定的连续性）
    let tempHigh, tempLow;
    
    if (i === 0) {
      // 确保最高温度和最低温度有足够的差距
      tempHigh = getRandomInt(tempRange[0], tempRange[1]);
      // 确保最低温度至少比最高温度低2度，同时不低于温度下限
      if (tempHigh - 2 < tempRange[0]) {
        tempLow = tempRange[0];
      } else {
        tempLow = getRandomInt(tempRange[0], tempHigh - 2);
      }
    } else {
      // 温度变化不会太剧烈
      const prevHigh = forecastData[i-1].temp_day;
      tempHigh = prevHigh + getRandomInt(-3, 3);
      tempHigh = Math.max(Math.min(tempHigh, tempRange[1]), tempRange[0]);
      
      // 确保最低温度范围有效
      if (tempHigh - 2 < tempRange[0]) {
        tempLow = tempRange[0];
      } else {
        tempLow = getRandomInt(tempRange[0], tempHigh - 2);
      }
    }
    
    // 生成风向和风力
    const windDirectionIndex = Math.floor(Math.random() * WIND_DIRECTIONS.length);
    const windDirection = WIND_DIRECTIONS[windDirectionIndex];
    const windPower = `${getRandomInt(1, 6)}级`;
    
    const dayData = {
      date: dateStr,
      week: weekDay,
      weather: weatherType,
      temp_day: tempHigh,
      temp_night: tempLow,
      wind_direction: windDirection,
      wind_power: windPower
    };
    
    forecastData.push(dayData);
  }
  
  return {
    city: city,
    province: CITY_PROVINCE[city],
    data: forecastData
  };
}

/**
 * 将中国天气数据格式化为可读字符串
 * @param {Object} data 天气数据对象
 * @returns {string} 格式化后的字符串
 */
function formatChinaWeather(data) {
  if (!data) {
    return "无法获取天气数据。";
  }
  
  const city = data.city || "未知城市";
  const province = data.province || "";
  const forecasts = [];
  
  for (const day of data.data || []) {
    const date = day.date || "未知日期";
    const week = day.week || "";
    const weather = day.weather || "未知";
    const tempDay = day.temp_day || "";
    const tempNight = day.temp_night || "";
    const windDirection = day.wind_direction || "";
    const windPower = day.wind_power || "";
    
    const dayInfo = `
日期: ${date} ${week}
天气: ${weather}
温度: ${tempDay}°C ~ ${tempNight}°C
风力: ${windDirection} ${windPower}
`;
    forecasts.push(dayInfo);
  }
  
  const header = province ? `📍 ${province} ${city}` : `📍 ${city}`;
  return `${header}\n\n` + forecasts.join("\n---\n");
}

// 注册MCP工具
server.tool(
  "get_china_weather",
  "查询中国城市的天气预报。",
  {
    city: z.string().describe('中国城市名称（例如"北京"、"上海"、"广州"）')
  },
  async ({ city }) => {
    // 生成模拟天气数据
    const weatherData = generateWeatherData(city);
    
    if (!weatherData) {
      return {
        content: [{
          type: "text",
          text: `无法获取${city}的天气信息。请提供准确的中国城市名称（如北京、上海、广州等）。`
        }]
      };
    }
    
    // 格式化天气信息
    const result = formatChinaWeather(weatherData);
    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  }
);

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
    
    const province = CITY_PROVINCE[city] || "未知";
    const location = CITY_LOCATIONS[city] || { lat: "未知", lon: "未知" };
    
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