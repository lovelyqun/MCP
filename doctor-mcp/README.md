# Doctor MCP - 医疗诊断助手

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![MCP](https://img.shields.io/badge/MCP-1.11.2-orange.svg)

一个基于 Model Context Protocol (MCP) 的智能医疗诊断助手服务器，提供结构化的医患对话流程和诊断辅助功能。

## ✨ 功能特性

- 🏥 **标准化诊断流程**：遵循医学诊断的7个标准步骤
- 💬 **交互式对话**：真实的医患对话体验，支持用户输入等待
- 💾 **会话持久化**：自动保存诊断会话，支持断点续传
- 🔄 **状态管理**：完整的会话状态跟踪和管理
- 📋 **结构化记录**：完整记录诊断过程和患者回答
- 🛡️ **输入验证**：使用 Zod 进行参数验证
- 🗂️ **多会话支持**：同时管理多个诊断会话

## 🚀 快速开始

### 环境要求

- Node.js 18.0.0 或更高版本
- npm 或 yarn 包管理器

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd doctor-mcp
```

2. **安装依赖**
```bash
npm install
```

3. **启动服务器**
```bash
npm start
```

## ⚙️ 配置说明

### Claude Desktop 配置

将以下配置添加到 Claude Desktop 的配置文件中：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "assistant-doctor": {
      "command": "npm",
      "args": [
        "start",
        "--prefix",
        "/path/to/your/doctor-mcp"
      ],
      "env": {}
    }
  }
}
```

> **注意**: 请将 `/path/to/your/doctor-mcp` 替换为你的实际项目路径。

### 会话存储

- 会话文件自动保存在 `./medical_sessions/` 目录下
- 每个会话以 JSON 格式存储，文件名为 `{sessionId}.json`
- 支持服务器重启后恢复会话

## 📋 诊断流程

医疗诊断助手遵循标准的7步诊断流程：

| 步骤 | 类型 | 描述 | 等待用户输入 |
|------|------|------|-------------|
| 1 | 主诉采集 | 了解患者主要症状和开始时间 | ✅ |
| 2 | 症状详询 | 深入了解症状特征和伴随症状 | ✅ |
| 3 | 病史采集 | 既往史、家族史、生活史调查 | ✅ |
| 4 | 辅助检查 | 收集已有的检查资料 | ✅ |
| 5 | 综合分析 | 医生进行症状分析与鉴别诊断 | ❌ |
| 6 | 检查建议 | 制定进一步检查计划 | ❌ |
| 7 | 诊断沟通 | 解释诊断结果与治疗方案 | ❌ |

## 🛠️ API 使用指南

### 工具1: assistant-doctor

主要的医疗诊断工具，支持完整的诊断流程。

#### 参数

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `action` | string | ❌ | 操作类型: `start`、`continue`、`complete` |
| `problem` | string | 条件性 | 患者主诉（开始新会话时必需） |
| `thought` | string | ❌ | 患者回答或医生分析内容 |
| `sessionId` | string | 条件性 | 会话ID（继续已有会话时必需） |
| `totalSteps` | number | ❌ | 诊断步骤总数（默认7步） |

#### 使用示例

**开始新的诊断会话:**
```javascript
{
  "action": "start",
  "problem": "患者主诉头痛3天，伴有发热"
}
```

**继续诊断会话（患者回答）:**
```javascript
{
  "action": "continue", 
  "sessionId": "medical_1234567890_abc123def",
  "thought": "头痛主要在额部，持续性胀痛，活动后加重..."
}
```

**医生分析:**
```javascript
{
  "action": "continue",
  "sessionId": "medical_1234567890_abc123def", 
  "thought": "根据患者描述，考虑紧张性头痛可能..."
}
```

**完成诊断:**
```javascript
{
  "action": "complete",
  "sessionId": "medical_1234567890_abc123def",
  "thought": "诊断完成，建议继续观察并按医嘱用药"
}
```

### 工具2: list_assistant_doctor_sessions

查看所有医疗诊断会话列表。

#### 参数

无需参数。

#### 使用示例

```javascript
{}
```

## 🔄 工作流程

### 典型的诊断流程

1. **启动诊断** - AI助手使用 `action: "start"` 开始新会话
2. **医生提问** - 系统显示医生问题，状态为 `WAITING_FOR_USER_INPUT`
3. **用户回答** - 真实用户提供患者回答
4. **继续诊断** - AI助手使用 `action: "continue"` 处理回答并进入下一步
5. **重复步骤** - 重复2-4直到完成所有诊断步骤
6. **完成诊断** - 使用 `action: "complete"` 结束会话

### 重要机制：等待用户输入

当工具返回包含 `WAITING_FOR_USER_INPUT` 状态时：

- ⚠️ **AI助手必须停止生成内容**
- 👥 **等待真实用户的回答**
- 🚫 **AI不应代替用户回答医生问题**
- ⏳ **保持会话状态，等待用户输入**

## 📁 文件结构

```
doctor-mcp/
├── doctor.js              # 主服务器文件
├── package.json           # 项目配置
├── config-example.json    # 配置示例
├── README.md              # 项目文档
└── medical_sessions/      # 会话存储目录
    └── medical_*.json     # 会话文件
```

## 🔧 开发信息

### 依赖包

- `@modelcontextprotocol/sdk`: MCP协议SDK
- `zod`: 运行时类型验证

### 脚本命令

```bash
npm start          # 启动MCP服务器
npm test           # 测试启动（显示启动信息）
```

## ⚠️ 注意事项

1. **医疗免责声明**: 本工具仅供教育和辅助用途，不能替代专业医疗诊断
2. **隐私保护**: 会话数据存储在本地，请妥善保管敏感信息
3. **真实交互**: 诊断过程需要真实用户参与，AI不应代替患者回答
4. **数据安全**: 定期备份会话数据，避免重要信息丢失

## 🐛 故障排除

### 常见问题

**Q: 服务器启动失败**
A: 检查Node.js版本是否符合要求，确保依赖已正确安装

**Q: 会话无法保存**
A: 检查 `medical_sessions` 目录的写入权限

**Q: Claude Desktop无法连接**
A: 验证配置文件路径是否正确，重启Claude Desktop

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目！

---

**免责声明**: 本医疗诊断助手仅供教育和研究用途，不能替代专业医疗建议、诊断或治疗。如有健康问题，请咨询合格的医疗专业人员。 