// 导入所需模块
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// 医疗诊断会话存储
let medicalSessions = new Map();

// 会话文件存储目录
const SESSIONS_DIR = './medical_sessions';

// 确保会话目录存在
function ensureSessionsDirectory() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

// 保存会话到文件
function saveSessionToFile(session) {
  try {
    ensureSessionsDirectory();
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
  } catch (error) {
    console.error(`保存会话失败 ${session.id}:`, error.message);
  }
}

// 从文件加载会话
function loadSessionFromFile(sessionId) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      const sessionData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(sessionData);
    }
  } catch (error) {
    console.error(`加载会话失败 ${sessionId}:`, error.message);
  }
  return null;
}

// 保存会话（内存+文件）
function saveSession(session) {
  medicalSessions.set(session.id, session);
  saveSessionToFile(session);
}

// 加载会话（优先从内存，其次从文件）
function loadSession(sessionId) {
  if (medicalSessions.has(sessionId)) {
    return medicalSessions.get(sessionId);
  }
  
  const session = loadSessionFromFile(sessionId);
  if (session) {
    medicalSessions.set(sessionId, session);
    return session;
  }
  
  return null;
}

// 初始化MCP服务器
const server = new McpServer({
  name: "medical_diagnosis",
  version: "1.0.0",
  capabilities: {
    tools: {}
  }
});

// 生成会话ID
function generateSessionId() {
  return `medical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 医疗诊断步骤定义
function getMedicalDiagnosisSteps() {
  return [
    {
      type: "question",
      content: "您好，请您放松。我是您的医生，会仔细倾听您的情况。请告诉我：今天是什么不舒服让您来看医生的？这个症状是什么时候开始的？现在感觉怎么样？",
      waitForResponse: true,
      responseKey: "chief_complaint"
    },
    {
      type: "question", 
      content: "谢谢您的描述。为了更好地帮助您，我需要了解症状的细节。请详细描述一下：这个症状具体是什么感觉？如果是疼痛，是哪种痛法（刺痛、胀痛、绞痛等）？有什么情况会让它加重或减轻吗？还有其他伴随的不舒服吗？",
      waitForResponse: true,
      responseKey: "symptom_details"
    },
    {
      type: "question",
      content: "我理解您的担心。现在让我了解一下您的身体状况和病史。请告诉我：您之前有过类似的情况吗？有什么慢性疾病吗？家族中有类似的问题吗？您平时的生活作息、饮食习惯、工作压力怎么样？",
      waitForResponse: true,  
      responseKey: "medical_history"
    },
    {
      type: "question",
      content: "请问您最近有做过相关检查吗？比如测过血压、心率、体温吗？有做过血检、心电图或其他检查吗？如果有的话，请告诉我结果。如果没有，我会根据您提供的信息进行分析。",
      waitForResponse: true,
      responseKey: "recent_tests"
    },
    {
      type: "analysis",
      content: "现在让我整理和分析您提供的所有信息。根据您的症状特点、病史和检查情况，我来分析可能的诊断并进行鉴别诊断。",
      waitForResponse: false
    },
    {
      type: "recommendation",
      content: "基于我的分析，我建议您做一些进一步的检查来明确诊断。我会详细解释每项检查的目的和意义。",
      waitForResponse: false
    },
    {
      type: "diagnosis_communication",
      content: "根据所有的信息，我现在给您一个初步的诊断意见和治疗建议。我会用通俗易懂的话解释您的情况。",
      waitForResponse: false
    }
  ];
}

// 生成医疗诊断引导提示
function generateMedicalDiagnosisPrompts() {
  return [
    "1. 👨‍⚕️ 主诉采集：了解患者主要症状",
    "2. 🗣️ 症状详询：深入了解症状特征", 
    "3. 📝 病史采集：既往史、家族史、生活史",
    "4. 🔍 辅助检查：收集客观检查资料",
    "5. 🤔 综合分析：症状分析与鉴别诊断",
    "6. 🧪 进一步检查：制定检查计划",
    "7. 💬 诊断沟通：解释诊断与治疗方案"
  ].join('\n');
}



// 获取下一步诊断步骤
function getNextDiagnosisStep(session) {
  const medicalSteps = getMedicalDiagnosisSteps();
  const currentStepIndex = session.currentStep - 1;
  
  if (currentStepIndex < medicalSteps.length) {
    return medicalSteps[currentStepIndex];
  }
  
  return null;
}

// 格式化诊断过程输出
function formatDiagnosisProcess(session) {
  let output = `🏥 **医疗诊断过程**\n`;
  output += `📋 主诉: ${session.problem}\n`;
  output += `🎯 总步数: ${session.totalSteps} | 当前步数: ${session.currentStep}\n\n`;
  
  // 检查是否在等待患者回答
  if (session.waitingForPatientResponse) {
    output += `�� **状态: WAITING_FOR_USER_INPUT**\n`;
    output += `👨‍⚕️ 医生提问: ${session.currentQuestion}\n\n`;
    output += `⚠️ **重要提示**: 这是一个真实的医患对话，需要用户（患者）真实回答。AI助手不应该代替患者回答问题。\n`;
    output += `💡 请等待用户回答上述医生问题。\n\n`;
    output += `--- STOP GENERATION - WAITING FOR REAL USER INPUT ---\n\n`;
  }
  
  session.consultationSteps.forEach((step, index) => {
    const stepNum = index + 1;
    const status = stepNum === session.currentStep ? "🔄 进行中" : 
                   stepNum < session.currentStep ? "✅ 已完成" : "⏳ 待处理";
    
    output += `**步骤 ${stepNum}** ${status}\n`;
    
    // 显示医生问题或分析
    if (step.content) {
      if (step.type === 'question') {
        output += `👨‍⚕️ 医生: ${step.content}\n`;
      } else {
        output += `🩺 医生分析: ${step.content}\n`;
      }
    }
    
    // 显示患者回答
    if (step.patientResponse) {
      output += `👤 患者: ${step.patientResponse}\n`;
    }
    
    // 显示医生的诊断分析
    if (step.doctorAnalysis) {
      output += `🔍 医生诊断分析: ${step.doctorAnalysis}\n`;
    }
    
    output += `---\n`;
  });
  
  if (session.completed) {
    output += `\n🎉 **诊断过程完成**\n`;
    output += `📝 诊断总结: ${session.summary || '已完成完整的医疗诊断流程'}`;
  } else if (!session.waitingForPatientResponse) {
    output += `\n➡️ **下一步**\n`;
    const nextStep = getNextDiagnosisStep(session);
    if (nextStep) {
      output += `🔍 第${session.currentStep}步: ${nextStep.content}`;
    }
  }
  
  return output;
}

// 注册医疗诊断工具
server.tool(
  "assistant-doctor",
  "医疗诊断辅助工具。这是一个交互式诊断流程，当工具返回'WAITING_FOR_USER_INPUT'状态时，AI助手必须停止生成内容，等待真实用户的回答。AI不应该代替用户回答医生的问题。包括主诉采集、症状详询、病史采集、体格检查、诊断分析、检查建议和治疗方案制定。",
  {
    problem: z.string().optional().describe('患者主诉或医疗问题（新开始时必填）'),
    thought: z.string().optional().describe('患者回答或医生分析内容'),
    sessionId: z.string().optional().describe('诊断会话ID（继续已有会话时使用）'),
    action: z.enum(['start', 'continue', 'complete']).default('continue').describe('操作类型'),
    totalSteps: z.number().optional().describe('诊断步骤总数（默认7步）')
  },
  async ({ problem, thought, sessionId, action, totalSteps }) => {
    try {
      let session;
      
      switch (action) {
        case 'start':
          if (!problem) {
            return {
              content: [{
                type: "text",
                text: "❌ 开始医疗诊断需要提供患者主诉或症状描述"
              }]
            };
          }
          
          sessionId = generateSessionId();
          
          session = {
            id: sessionId,
            problem: problem,
            consultationSteps: [],
            currentStep: 1,
            totalSteps: totalSteps || 7,
            completed: false,
            createdAt: new Date().toISOString(),
            patientResponses: {}
          };
          
          // 立即开始第一个问诊步骤
          const firstStep = getNextDiagnosisStep(session);
          session.waitingForPatientResponse = firstStep.waitForResponse;
          session.currentQuestion = firstStep.content;
          session.currentResponseKey = firstStep.responseKey;
          
          // 添加第一个问题到诊断记录
          session.consultationSteps.push({
            step: session.currentStep,
            content: firstStep.content,
            type: firstStep.type,
            timestamp: new Date().toISOString()
          });
          
          saveSession(session);
          
          return {
            content: [{
              type: "text", 
              text: `🏥 **医疗诊断会话已创建**\n\n📋 患者主诉: ${problem}\n🆔 会话ID: ${sessionId}\n👨‍⚕️ 开始诊断流程...\n\n🧭 **诊断步骤:**\n${generateMedicalDiagnosisPrompts()}\n\n${formatDiagnosisProcess(session)}`
            }]
          };
          
        case 'continue':
          if (!sessionId || !loadSession(sessionId)) {
            return {
              content: [{
                type: "text",
                text: "❌ 无效的会话ID。请先使用 action='start' 创建新的诊断会话"
              }]
            };
          }
          
          session = loadSession(sessionId);
          
          if (session.completed) {
            return {
              content: [{
                type: "text",
                text: "ℹ️ 该诊断会话已完成。可以使用 action='start' 开始新的诊断会话"
              }]
            };
          }
          
          // 处理患者回答或医生分析
          if (session.waitingForPatientResponse && thought) {
            // 保存患者回答
            const currentStepIndex = session.currentStep - 1;
            session.consultationSteps[currentStepIndex].patientResponse = thought;
            session.patientResponses[session.currentResponseKey] = thought;
            session.waitingForPatientResponse = false;
            
            // 进入下一步
            session.currentStep++;
            
            if (session.currentStep <= session.totalSteps) {
              const nextStep = getNextDiagnosisStep(session);
              if (nextStep) {
                session.waitingForPatientResponse = nextStep.waitForResponse;
                session.currentQuestion = nextStep.content;
                session.currentResponseKey = nextStep.responseKey;
                
                // 添加下一个步骤
                session.consultationSteps.push({
                  step: session.currentStep,
                  content: nextStep.content,
                  type: nextStep.type,
                  timestamp: new Date().toISOString()
                });
              }
            } else {
              session.completed = true;
            }
          } else if (!session.waitingForPatientResponse && thought) {
            // 医生的分析或诊断
            const currentStepIndex = session.currentStep - 1;
            if (currentStepIndex < session.consultationSteps.length) {
              session.consultationSteps[currentStepIndex].doctorAnalysis = thought;
            }
            
            // 进入下一步
            session.currentStep++;
            if (session.currentStep <= session.totalSteps) {
              const nextStep = getNextDiagnosisStep(session);
              if (nextStep) {
                session.waitingForPatientResponse = nextStep.waitForResponse;
                session.currentQuestion = nextStep.content;
                session.currentResponseKey = nextStep.responseKey;
                
                session.consultationSteps.push({
                  step: session.currentStep,
                  content: nextStep.content,
                  type: nextStep.type,
                  timestamp: new Date().toISOString()
                });
              }
            } else {
              session.completed = true;
            }
          } else if (session.waitingForPatientResponse && !thought) {
            // 当前正在等待患者回答，但没有提供回答
            // 这种情况下应该结束当前对话，让用户输入
            saveSession(session);
            
            return {
              content: [{
                type: "text",
                text: formatDiagnosisProcess(session)
              }]
            };
          }
          
          saveSession(session);
          break;
          
        case 'complete':
          if (!sessionId || !loadSession(sessionId)) {
            return {
              content: [{
                type: "text",
                text: "❌ 无效的会话ID"
              }]
            };
          }
          
          session = loadSession(sessionId);
          session.completed = true;
          session.summary = thought || "诊断过程已完成";
          session.completedAt = new Date().toISOString();
          
          saveSession(session);
          break;
      }
      
      // 返回格式化的诊断过程
      const result = formatDiagnosisProcess(session);
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ 处理医疗诊断时出错: ${error.message}`
        }]
      };
    }
  }
);

// 注册简单的会话列表工具
server.tool(
  "list_assistant_doctor_sessions",
  "查看医疗诊断会话列表",
  {},
  async () => {
    if (medicalSessions.size === 0) {
      return {
        content: [{
          type: "text",
          text: "📝 暂无活跃的医疗诊断会话"
        }]
      };
    }
    
    let output = "🏥 **医疗诊断会话列表**\n\n";
    
    for (const [id, session] of medicalSessions) {
      const status = session.completed ? "✅ 已完成" : "🔄 进行中";
      output += `**${id}** ${status}\n`;
      output += `📋 患者主诉: ${session.problem}\n`;
      output += `📊 进度: ${session.consultationSteps.length}/${session.totalSteps}\n`;
      output += `⏰ 创建时间: ${new Date(session.createdAt).toLocaleString()}\n`;
      if (session.waitingForPatientResponse) {
        output += `🔴 等待患者回答\n`;
      }
      output += `---\n`;
    }
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  }
);

// 运行服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // 确保会话目录存在
  ensureSessionsDirectory();
  
  console.error("医疗诊断MCP服务器已启动...");
  console.error(`会话存储目录: ${path.resolve(SESSIONS_DIR)}`);
  
  // 显示现有会话统计
  try {
    const existingSessionCount = fs.readdirSync(SESSIONS_DIR).filter(file => file.endsWith('.json')).length;
    if (existingSessionCount > 0) {
      console.error(`发现 ${existingSessionCount} 个已保存的会话文件`);
    }
  } catch (error) {
    // 目录不存在时忽略错误
  }
}

main().catch(error => {
  console.error("服务器运行错误:", error);
  process.exit(1);
});