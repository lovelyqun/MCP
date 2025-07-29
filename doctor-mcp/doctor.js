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
  version: "2.0.0",
  capabilities: {
    tools: {}
  }
});

// 生成会话ID
function generateSessionId() {
  return `medical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 诊断阶段枚举
const DIAGNOSIS_PHASES = {
  CHIEF_COMPLAINT: 'chief_complaint',
  SYMPTOM_ANALYSIS: 'symptom_analysis', 
  MEDICAL_HISTORY: 'medical_history',
  PHYSICAL_EXAMINATION: 'physical_examination',
  DIFFERENTIAL_DIAGNOSIS: 'differential_diagnosis',
  INVESTIGATION_PLANNING: 'investigation_planning',
  DIAGNOSIS_FORMULATION: 'diagnosis_formulation',
  TREATMENT_PLANNING: 'treatment_planning',
  PATIENT_EDUCATION: 'patient_education',
  COMPLETED: 'completed'
};

// 获取阶段的中文描述
function getPhaseDescription(phase) {
  const descriptions = {
    [DIAGNOSIS_PHASES.CHIEF_COMPLAINT]: '主诉采集',
    [DIAGNOSIS_PHASES.SYMPTOM_ANALYSIS]: '症状分析',
    [DIAGNOSIS_PHASES.MEDICAL_HISTORY]: '病史询问', 
    [DIAGNOSIS_PHASES.PHYSICAL_EXAMINATION]: '体格检查',
    [DIAGNOSIS_PHASES.DIFFERENTIAL_DIAGNOSIS]: '鉴别诊断',
    [DIAGNOSIS_PHASES.INVESTIGATION_PLANNING]: '检查规划',
    [DIAGNOSIS_PHASES.DIAGNOSIS_FORMULATION]: '诊断制定',
    [DIAGNOSIS_PHASES.TREATMENT_PLANNING]: '治疗方案',
    [DIAGNOSIS_PHASES.PATIENT_EDUCATION]: '患者教育',
    [DIAGNOSIS_PHASES.COMPLETED]: '诊断完成'
  };
  return descriptions[phase] || phase;
}

// 医疗知识提示词系统
const MEDICAL_PROMPTS = {
  CHIEF_COMPLAINT: `作为专业医生，我需要全面了解患者的主诉。重点关注：症状的OPQRST分析（起始、挑拨、性质、放射、伴随症状、时间）`,
  SYMPTOM_ANALYSIS: `基于医学症状学，我需要详细分析症状特征，考虑解剖位置、病理生理机制、可能的疾病谱`,
  MEDICAL_HISTORY: `从临床医学角度，既往史、家族史、个人史对诊断至关重要，需要系统性询问相关疾病史`,
  PHYSICAL_EXAMINATION: `结合临床体格检查要点，收集客观体征，为诊断提供重要线索`,
  DIFFERENTIAL_DIAGNOSIS: `运用临床推理，基于收集的信息进行鉴别诊断，考虑常见病、多发病及危重症`,
  INVESTIGATION_PLANNING: `根据临床表现制定个性化检查方案，遵循循证医学原则`,
  DIAGNOSIS_FORMULATION: `综合病史、体征、检查结果，形成临床诊断，说明诊断依据`,
  TREATMENT_PLANNING: `制定个体化治疗方案，考虑药物治疗、非药物治疗、生活方式干预`,
  PATIENT_EDUCATION: `患者教育是治疗的重要组成部分，需要通俗易懂地解释病情和注意事项`
};

// 生成医疗AI分析
function generateMedicalAnalysis(phase, collectedInfo, specificSymptom = '') {
  const prompt = MEDICAL_PROMPTS[phase] || '';
  
  switch (phase) {
    case DIAGNOSIS_PHASES.SYMPTOM_ANALYSIS:
      return `${prompt}

**医学分析：**
基于患者描述的"${specificSymptom}"，从医学角度分析：

1. **解剖学考虑**：根据症状位置，涉及的可能解剖结构
2. **病理生理机制**：症状产生的可能机制
3. **鉴别诊断思路**：需要考虑的疾病类别
4. **红旗症状识别**：是否存在提示严重疾病的警示症状

**临床提醒：**如有以下情况需要立即就医：剧烈疼痛、呼吸困难、意识改变、持续高热等。`;

    case DIAGNOSIS_PHASES.DIFFERENTIAL_DIAGNOSIS:
      return `${prompt}

**综合医学分析：**
基于收集的临床信息，进行系统性分析：

**症状概要：**
- 主诉：${collectedInfo.chiefComplaint || '待明确'}
- 症状特征：${collectedInfo.symptomDetails || '需进一步评估'}
- 相关病史：${collectedInfo.medicalHistory || '需完善'}
- 体征/检查：${collectedInfo.physicalExamination || '待完善'}

**医学推理过程：**
1. **首要考虑诊断**：基于症状模式的最可能诊断
2. **鉴别诊断清单**：需要排除的其他可能疾病
3. **风险分层**：评估紧急程度和严重性
4. **临床决策点**：关键的诊断要素分析

**医疗安全提醒：**
- 请注意观察症状变化
- 如症状加重或出现新症状应及时就医
- 本分析仅供参考，不能替代面诊`;

    case DIAGNOSIS_PHASES.INVESTIGATION_PLANNING:
      return `${prompt}

**个性化检查建议：**
根据患者的临床表现，建议进行以下检查：

**基础检查（推荐）：**
- 实验室检查：血常规、生化全套、炎症指标
- 影像学检查：根据症状选择X光、超声、CT等
- 心电图检查：评估心脏功能

**专科检查（如需要）：**
根据症状特点可能需要的专科检查

**检查优先级：**
1. 紧急检查：排除危及生命的疾病
2. 常规检查：明确诊断的必要检查
3. 补充检查：进一步评估的检查

**就医指导：**
建议您携带此分析结果到相应科室就诊，医生会根据实际情况调整检查方案。`;

    case DIAGNOSIS_PHASES.DIAGNOSIS_FORMULATION:
      return `${prompt}

**临床诊断分析：**

**最可能诊断：**
基于收集的所有信息，最符合的诊断考虑

**诊断依据：**
1. 症状学依据：症状特征与疾病的符合性
2. 流行病学依据：年龄、性别、地区等因素
3. 排除依据：已排除的其他可能疾病

**诊断的确定性：**
- 高度可能（>80%）：症状典型，符合疾病特征
- 中等可能（50-80%）：症状较符合，需进一步检查
- 低度可能（<50%）：症状不典型，需要鉴别

**医疗建议：**
建议就诊科室和进一步处理意见`;

    case DIAGNOSIS_PHASES.TREATMENT_PLANNING:
      return `${prompt}

**个体化治疗方案：**

**治疗目标：**
1. 缓解症状，改善生活质量
2. 针对病因进行治疗
3. 预防并发症的发生

**治疗方案：**
1. **药物治疗**：
   - 症状缓解药物
   - 病因治疗药物
   - 用药注意事项

2. **非药物治疗**：
   - 物理治疗方法
   - 康复训练建议
   - 生活方式调整

3. **监测随访**：
   - 症状观察要点
   - 复诊时间建议
   - 预警指标

**自我管理指导：**
患者可以在家中进行的自我护理措施`;

    case DIAGNOSIS_PHASES.PATIENT_EDUCATION:
      return `${prompt}

**健康教育指导：**

**疾病认知：**
用通俗易懂的语言解释您的病情：
- 疾病的本质和原因
- 症状产生的机制
- 疾病的一般发展过程

**日常注意事项：**
1. **生活方式建议**：
   - 作息时间调整
   - 饮食营养指导
   - 运动锻炼建议

2. **症状监测**：
   - 需要观察的症状变化
   - 记录症状的方法
   - 何时需要紧急就医

3. **用药指导**：
   - 正确的用药方法
   - 可能的副作用
   - 用药期间的注意事项

**预后信息：**
大多数情况下的预期结果和康复时间

**心理支持：**
疾病可能带来的心理影响和应对方法`;

    default:
      return prompt || `**医学分析：**
      
基于循证医学原理，对当前临床情况进行专业分析：

**临床评估：**
根据收集的症状和体征信息，进行系统性医学评估。

**医学建议：**
建议进一步观察症状变化，必要时及时就医咨询专业医生。

**重要提醒：**
本分析仅供参考，最终诊断需要专业医生面诊确认。`;
  }
}

// 生成下一步诊断指导（增强医疗智能）
function generateNextStepGuidance(session) {
  const currentPhase = session.currentPhase;
  const collectedInfo = session.collectedInfo;
  
  // 根据当前阶段和已收集信息，生成下一步指导
  switch (currentPhase) {
    case DIAGNOSIS_PHASES.CHIEF_COMPLAINT:
      return {
        type: "question",
        content: `您好，我是您的医生助理智能体，具备专业的医学知识。请详细告诉我您的情况：

1）**主要症状**：今天什么不舒服让您来咨询？
2）**时间过程**：症状什么时候开始的？是突然还是逐渐出现？
3）**当前状况**：现在感觉怎么样？症状是加重、减轻还是保持不变？
4）**影响程度**：症状对您的日常生活造成了什么影响？

请尽可能详细地描述，这将帮助我为您提供更准确的医疗分析。`,
        waitForResponse: true,
        phase: DIAGNOSIS_PHASES.CHIEF_COMPLAINT,
        guidance: "运用OPQRST方法收集主诉，进行初步医学评估"
      };
      
    case DIAGNOSIS_PHASES.SYMPTOM_ANALYSIS:
      const symptomKeywords = collectedInfo.chiefComplaint || '症状';
      return {
        type: "question", 
        content: `基于您提到的"${symptomKeywords}"，我需要进行详细的症状分析：

**症状特征分析：**
1）**性质描述**：具体是什么感觉？（刺痛、胀痛、压迫感、烧灼感等）
2）**位置定位**：准确的部位？是否有放射到其他地方？
3）**诱发因素**：什么情况下会加重？（活动、休息、饮食、情绪等）
4）**缓解因素**：什么方法能让症状减轻？
5）**伴随症状**：还有其他不舒服吗？（发热、恶心、头晕等）
6）**严重程度**：用1-10分评估，10分是无法忍受的疼痛

**时间模式：**
症状是持续性的还是间歇性的？一天中什么时候最重？`,
        waitForResponse: true,
        phase: DIAGNOSIS_PHASES.SYMPTOM_ANALYSIS,
        guidance: "进行系统性症状学分析，建立症状与疾病的关联"
      };
      
    case DIAGNOSIS_PHASES.MEDICAL_HISTORY:
      return {
        type: "question",
        content: `现在我需要了解您的健康背景，这对准确诊断非常重要：

**既往病史：**
1）您之前有过类似症状吗？什么时候？怎么处理的？
2）有什么慢性疾病吗？（高血压、糖尿病、心脏病等）
3）做过什么手术吗？
4）有过敏史吗？对什么过敏？

**用药史：**
目前在服用什么药物？（包括处方药、非处方药、保健品）

**家族史：**
家人有类似疾病或相关遗传疾病吗？

**生活史：**
1）工作性质和环境如何？
2）吸烟喝酒情况？
3）饮食习惯和睡眠质量？
4）最近有什么特殊情况或生活变化吗？

**女性患者特殊询问：**
月经情况？是否怀孕或哺乳期？`,
        waitForResponse: true,
        phase: DIAGNOSIS_PHASES.MEDICAL_HISTORY,
        guidance: "全面收集病史信息，识别疾病相关危险因素"
      };
      
    case DIAGNOSIS_PHASES.PHYSICAL_EXAMINATION:
      return {
        type: "question",
        content: `请告诉我您能观察到的体征和任何检查结果：

**生命体征：**
1）体温多少？有发热吗？
2）血压情况？（如果最近测量过）
3）心跳感觉正常吗？有心慌吗？

**自我检查：**
1）皮肤颜色正常吗？有红肿、苍白或发绀吗？
2）有明显的肿胀或触痛吗？
3）活动是否受限？
4）呼吸是否正常？

**已有检查结果：**
1）最近做过血检吗？结果如何？
2）拍过X光、CT或其他影像检查吗？
3）做过心电图吗？
4）其他任何检查结果？

**专科检查：**
如果您已经看过医生，医生说了什么？做了什么检查？

请提供您能获得的所有客观信息，这将帮助我进行更准确的医学分析。`,
        waitForResponse: true,
        phase: DIAGNOSIS_PHASES.PHYSICAL_EXAMINATION,
        guidance: "收集客观体征和检查资料，完善诊断依据"
      };
      
    default:
      return null;
  }
}

// 执行专业医疗诊断分析
function performDiagnosisAnalysis(session) {
  const info = session.collectedInfo;
  const medicalAnalysis = generateMedicalAnalysis(DIAGNOSIS_PHASES.DIFFERENTIAL_DIAGNOSIS, info);
  
  return {
    type: "analysis",
    content: `${medicalAnalysis}

**请注意：** 这是基于AI医疗知识的初步分析，用于参考。最终诊断需要专业医生面诊确认。`,
    waitForResponse: false,
    phase: session.currentPhase,
    guidance: "运用医学知识进行鉴别诊断和风险评估",
    medicalPrompt: MEDICAL_PROMPTS.DIFFERENTIAL_DIAGNOSIS
  };
}

// 智能决定下一步
function determineNextStep(session) {
  const info = session.collectedInfo;
  const currentPhase = session.currentPhase;
  
  // 检查必要信息是否收集完整
  const hasChiefComplaint = info.chiefComplaint && info.chiefComplaint.length > 10;
  const hasSymptomDetails = info.symptomDetails && info.symptomDetails.length > 10;
  const hasMedicalHistory = info.medicalHistory && info.medicalHistory.length > 10;
  const hasPhysicalExam = info.physicalExamination;
  
  // 根据当前阶段和信息完整性决定下一步
  switch (currentPhase) {
    case DIAGNOSIS_PHASES.CHIEF_COMPLAINT:
      if (hasChiefComplaint) {
        session.currentPhase = DIAGNOSIS_PHASES.SYMPTOM_ANALYSIS;
        return generateNextStepGuidance(session);
      }
      break;
      
    case DIAGNOSIS_PHASES.SYMPTOM_ANALYSIS:
      if (hasSymptomDetails) {
        session.currentPhase = DIAGNOSIS_PHASES.MEDICAL_HISTORY;
        return generateNextStepGuidance(session);
      }
      break;
      
    case DIAGNOSIS_PHASES.MEDICAL_HISTORY:
      if (hasMedicalHistory) {
        session.currentPhase = DIAGNOSIS_PHASES.PHYSICAL_EXAMINATION;
        return generateNextStepGuidance(session);
      }
      break;
      
    case DIAGNOSIS_PHASES.PHYSICAL_EXAMINATION:
      if (hasPhysicalExam) {
        session.currentPhase = DIAGNOSIS_PHASES.DIFFERENTIAL_DIAGNOSIS;
        return performDiagnosisAnalysis(session);
      }
      break;
      
    case DIAGNOSIS_PHASES.DIFFERENTIAL_DIAGNOSIS:
      session.currentPhase = DIAGNOSIS_PHASES.INVESTIGATION_PLANNING;
      const investigationAnalysis = generateMedicalAnalysis(DIAGNOSIS_PHASES.INVESTIGATION_PLANNING, info);
      return {
        type: "analysis",
        content: investigationAnalysis,
        waitForResponse: false,
        phase: DIAGNOSIS_PHASES.INVESTIGATION_PLANNING,
        guidance: "基于医学证据制定个性化检查方案",
        medicalPrompt: MEDICAL_PROMPTS.INVESTIGATION_PLANNING
      };
      
    case DIAGNOSIS_PHASES.INVESTIGATION_PLANNING:
      session.currentPhase = DIAGNOSIS_PHASES.DIAGNOSIS_FORMULATION;
      const diagnosisAnalysis = generateMedicalAnalysis(DIAGNOSIS_PHASES.DIAGNOSIS_FORMULATION, info);
      return {
        type: "analysis", 
        content: diagnosisAnalysis,
        waitForResponse: false,
        phase: DIAGNOSIS_PHASES.DIAGNOSIS_FORMULATION,
        guidance: "运用临床推理形成最终诊断",
        medicalPrompt: MEDICAL_PROMPTS.DIAGNOSIS_FORMULATION
      };
      
    case DIAGNOSIS_PHASES.DIAGNOSIS_FORMULATION:
      session.currentPhase = DIAGNOSIS_PHASES.TREATMENT_PLANNING;
      const treatmentAnalysis = generateMedicalAnalysis(DIAGNOSIS_PHASES.TREATMENT_PLANNING, info);
      return {
        type: "analysis",
        content: treatmentAnalysis, 
        waitForResponse: false,
        phase: DIAGNOSIS_PHASES.TREATMENT_PLANNING,
        guidance: "制定循证医学治疗方案",
        medicalPrompt: MEDICAL_PROMPTS.TREATMENT_PLANNING
      };
      
    case DIAGNOSIS_PHASES.TREATMENT_PLANNING:
      session.currentPhase = DIAGNOSIS_PHASES.PATIENT_EDUCATION;
      const educationAnalysis = generateMedicalAnalysis(DIAGNOSIS_PHASES.PATIENT_EDUCATION, info);
      return {
        type: "analysis",
        content: educationAnalysis,
        waitForResponse: false,
        phase: DIAGNOSIS_PHASES.PATIENT_EDUCATION,
        guidance: "提供全面的患者健康教育",
        medicalPrompt: MEDICAL_PROMPTS.PATIENT_EDUCATION
      };
      
    case DIAGNOSIS_PHASES.PATIENT_EDUCATION:
      session.currentPhase = DIAGNOSIS_PHASES.COMPLETED;
      session.completed = true;
      return {
        type: "completion",
        content: `🎉 **诊断过程完成**\n\n完整的医疗诊断和治疗方案已经制定完成。包含专业医学分析、个性化治疗建议和全面患者教育。\n\n📋 **诊断总结**：基于循证医学原理的系统性诊断已完成\n💊 **治疗方案**：个体化治疗计划已制定\n🎓 **健康教育**：全面的自我管理指导已提供\n\n⚠️ **重要提醒**：本诊断仅供参考，建议携带此分析结果到相应科室就诊确认。`,
        waitForResponse: false,
        phase: DIAGNOSIS_PHASES.COMPLETED,
        guidance: "完成整个智能医疗诊断流程"
      };
  }
  
  return generateNextStepGuidance(session);
}

// 记录完整对话消息
function addDialogueRecord(session, speaker, content, metadata = {}) {
  if (!session.fullDialogueHistory) {
    session.fullDialogueHistory = [];
  }
  
  const record = {
    timestamp: new Date().toISOString(),
    speaker: speaker, // 'doctor', 'patient', 'system', 'ai_analysis'
    content: content,
    phase: session.currentPhase,
    metadata: metadata
  };
  
  session.fullDialogueHistory.push(record);
  return record;
}

// 格式化完整对话历史
function formatFullDialogueHistory(session) {
  if (!session.fullDialogueHistory || session.fullDialogueHistory.length === 0) {
    return "暂无对话记录";
  }
  
  let output = `📖 **完整对话记录**\n\n`;
  
  session.fullDialogueHistory.forEach((record, index) => {
    const time = new Date(record.timestamp).toLocaleTimeString();
    const phaseDesc = getPhaseDescription(record.phase);
    
    switch (record.speaker) {
      case 'system':
        output += `🔧 [${time}] 系统: ${record.content}\n`;
        break;
      case 'doctor':
        output += `👨‍⚕️ [${time}] [${phaseDesc}] 医生: ${record.content}\n`;
        break;
      case 'patient':
        output += `👤 [${time}] 患者: ${record.content}\n`;
        break;
      case 'ai_analysis':
        output += `🤖 [${time}] [${phaseDesc}] AI分析: ${record.content}\n`;
        break;
      case 'ai_reasoning':
        output += `🧠 [${time}] [${phaseDesc}] AI推理: ${record.content}\n`;
        break;
    }
    
    if (record.metadata && Object.keys(record.metadata).length > 0) {
      output += `   📊 元数据: ${JSON.stringify(record.metadata, null, 2)}\n`;
    }
    
    output += `\n`;
  });
  
  return output;
}

// 格式化诊断过程输出（增强版）
function formatDiagnosisProcess(session, includeFullHistory = false) {
  let output = `🏥 **智能医疗诊断系统**\n`;
  output += `📋 患者主诉: ${session.problem}\n`;
  output += `🎯 当前阶段: ${getPhaseDescription(session.currentPhase)}\n`;
  output += `📊 诊断进度: ${session.consultationSteps.length} 个步骤已完成\n`;
  output += `💬 对话记录: ${session.fullDialogueHistory ? session.fullDialogueHistory.length : 0} 条\n\n`;
  
  // 检查是否在等待患者回答
  if (session.waitingForPatientResponse) {
    output += `⏱️ **状态: WAITING_FOR_USER_INPUT**\n`;
    output += `👨‍⚕️ 医生询问: ${session.currentQuestion}\n\n`;
    output += `⚠️ **重要**: 这是真实医患对话，需要用户作为患者真实回答。AI助手不应代替患者回答。\n`;
    output += `💡 请等待用户回答医生的问题。\n\n`;
    output += `--- STOP GENERATION - WAITING FOR REAL USER INPUT ---\n\n`;
  }
  
  // 显示收集的信息概览
  if (Object.keys(session.collectedInfo).length > 0) {
    output += `📝 **已收集信息概览:**\n`;
    if (session.collectedInfo.chiefComplaint) {
      output += `🔸 主诉: ${session.collectedInfo.chiefComplaint.substring(0, 100)}${session.collectedInfo.chiefComplaint.length > 100 ? '...' : ''}\n`;
    }
    if (session.collectedInfo.symptomDetails) {
      output += `🔸 症状详情: ${session.collectedInfo.symptomDetails.substring(0, 100)}${session.collectedInfo.symptomDetails.length > 100 ? '...' : ''}\n`;
    }
    if (session.collectedInfo.medicalHistory) {
      output += `🔸 病史: ${session.collectedInfo.medicalHistory.substring(0, 100)}${session.collectedInfo.medicalHistory.length > 100 ? '...' : ''}\n`;
    }
    if (session.collectedInfo.physicalExamination) {
      output += `🔸 检查: ${session.collectedInfo.physicalExamination.substring(0, 100)}${session.collectedInfo.physicalExamination.length > 100 ? '...' : ''}\n`;
    }
    output += `\n`;
  }
  
  // 显示详细的诊断步骤
  output += `🔍 **诊断步骤详情:**\n`;
  session.consultationSteps.forEach((step, index) => {
    const stepNum = index + 1;
    output += `**步骤 ${stepNum}: ${getPhaseDescription(step.phase)}**\n`;
    
    if (step.type === 'question') {
      output += `👨‍⚕️ 医生: ${step.content}\n`;
      if (step.patientResponse) {
        output += `👤 患者: ${step.patientResponse}\n`;
      }
    } else if (step.type === 'analysis') {
      output += `🩺 医生分析: ${step.content}\n`;
      if (step.doctorAnalysis) {
        output += `🔍 深度分析: ${step.doctorAnalysis}\n`;
      }
    }
    
    // 显示AI推理过程
    if (step.aiReasoning) {
      output += `🧠 AI推理: ${step.aiReasoning}\n`;
    }
    
    output += `---\n`;
  });
  
  if (session.completed) {
    output += `\n🎉 **诊断过程完成**\n`;
    output += `📋 最终诊断: ${session.finalDiagnosis || '请查看上述详细分析'}\n`;
    output += `💊 治疗建议: ${session.treatmentPlan || '请查看上述治疗方案'}\n`;
    
    if (session.completionAnalysis) {
      output += `🔬 完成分析: ${session.completionAnalysis}\n`;
    }
  } else if (!session.waitingForPatientResponse) {
    output += `\n➡️ **AI正在分析下一步...**\n`;
  }
  
  // 可选：显示完整对话历史
  if (includeFullHistory) {
    output += `\n${formatFullDialogueHistory(session)}`;
  }
  
  return output;
}

// 注册医生助理智能体工具
server.tool(
  "assistant-doctor",
  "AI医生助理智能体 - 具备专业医疗知识的智能诊断系统。运用循证医学原理进行症状分析、鉴别诊断、检查规划和治疗建议。包含完整的医患对话过程记录和医学推理分析。当工具返回'WAITING_FOR_USER_INPUT'状态时，AI助手必须停止生成内容，等待真实用户回答。⚠️医疗免责声明：本系统仅供参考，不能替代专业医生面诊，严重症状请及时就医。",
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
            currentPhase: DIAGNOSIS_PHASES.CHIEF_COMPLAINT,
            completed: false,
            createdAt: new Date().toISOString(),
            collectedInfo: {},
            aiPlanning: true,
            fullDialogueHistory: []
          };
          
          // 记录会话创建
          addDialogueRecord(session, 'system', `新医疗诊断会话创建: ${problem}`, {
            sessionId: sessionId,
            initialPhase: DIAGNOSIS_PHASES.CHIEF_COMPLAINT
          });
          
          // AI智能规划第一步
          const firstStep = generateNextStepGuidance(session);
          session.waitingForPatientResponse = firstStep.waitForResponse;
          session.currentQuestion = firstStep.content;
          session.currentStepGuidance = firstStep.guidance;
          
          // 记录AI规划过程
          addDialogueRecord(session, 'ai_reasoning', `AI智能规划第一步: ${firstStep.guidance}`, {
            targetPhase: firstStep.phase,
            questionType: firstStep.type,
            waitForResponse: firstStep.waitForResponse
          });
          
          // 记录医生问题
          addDialogueRecord(session, 'doctor', firstStep.content, {
            phase: firstStep.phase,
            guidance: firstStep.guidance
          });
          
          // 添加第一个问题到诊断记录
          session.consultationSteps.push({
            step: session.consultationSteps.length + 1,
            content: firstStep.content,
            type: firstStep.type,
            phase: firstStep.phase,
            guidance: firstStep.guidance,
            timestamp: new Date().toISOString(),
            aiReasoning: `AI分析: 开始${getPhaseDescription(firstStep.phase)}，${firstStep.guidance}`
          });
          
          saveSession(session);
          
          return {
            content: [{
              type: "text", 
              text: `🏥 **AI医生助理智能体已启动**\n\n👨‍⚕️ **系统介绍：**\n我是具备专业医疗知识的AI助理，运用循证医学原理为您提供：\n• 专业症状分析和医学推理\n• 系统性鉴别诊断思路\n• 个性化检查建议和治疗方案\n• 完整医患对话记录和分析\n\n📋 **患者主诉:** ${problem}\n🆔 **会话ID:** ${sessionId}\n\n🧭 **智能诊断流程：**\n• 主诉采集 → 症状分析 → 病史询问 → 体格检查\n• 鉴别诊断 → 检查规划 → 诊断制定 → 治疗方案\n• 患者教育（AI将根据具体情况动态调整）\n\n⚠️ **医疗免责声明：** 本系统基于医学知识提供参考建议，不能替代专业医生面诊。严重或紧急症状请立即就医。\n\n${formatDiagnosisProcess(session)}`
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
          
          // 处理患者回答
          if (session.waitingForPatientResponse && thought) {
            // 记录患者回答
            addDialogueRecord(session, 'patient', thought, {
              phase: session.currentPhase,
              responseLength: thought.length
            });
            
            // 保存患者回答到对应阶段
            const currentStepIndex = session.consultationSteps.length - 1;
            session.consultationSteps[currentStepIndex].patientResponse = thought;
            
            // 根据当前阶段保存信息
            let infoCategory = '';
            switch (session.currentPhase) {
              case DIAGNOSIS_PHASES.CHIEF_COMPLAINT:
                session.collectedInfo.chiefComplaint = thought;
                infoCategory = '主诉信息';
                break;
              case DIAGNOSIS_PHASES.SYMPTOM_ANALYSIS:
                session.collectedInfo.symptomDetails = thought;
                infoCategory = '症状详情';
                break;
              case DIAGNOSIS_PHASES.MEDICAL_HISTORY:
                session.collectedInfo.medicalHistory = thought;
                infoCategory = '病史信息';
                break;
              case DIAGNOSIS_PHASES.PHYSICAL_EXAMINATION:
                session.collectedInfo.physicalExamination = thought;
                infoCategory = '检查信息';
                break;
            }
            
            // 记录信息分类存储
            addDialogueRecord(session, 'ai_analysis', `收集${infoCategory}完成，内容长度: ${thought.length}字符`, {
              category: infoCategory,
              phase: session.currentPhase,
              dataStored: true
            });
            
            session.waitingForPatientResponse = false;
            
            // AI智能决定下一步，并自动处理所有非交互步骤
            let continueProcessing = true;
            let maxIterations = 10;
            let iterations = 0;
            
            while (continueProcessing && iterations < maxIterations) {
              iterations++;
              const currentPhase = session.currentPhase; // 保存当前阶段用于记录
              const nextStep = determineNextStep(session);
              
              if (!nextStep) {
                continueProcessing = false;
                break;
              }
              
              // 记录AI决策过程
              addDialogueRecord(session, 'ai_reasoning', `AI决策: 从${getPhaseDescription(currentPhase)}转入${getPhaseDescription(nextStep.phase)}`, {
                fromPhase: currentPhase,
                toPhase: nextStep.phase,
                reasoning: nextStep.guidance,
                decisionLogic: `基于已收集信息质量和完整性做出转换决定`,
                iteration: iterations
              });
              
              // 重要：确保session的currentPhase已经在determineNextStep中更新
              session.waitingForPatientResponse = nextStep.waitForResponse;
              session.currentQuestion = nextStep.content;
              session.currentStepGuidance = nextStep.guidance;
              
              // 记录新的医生问题或分析
              if (nextStep.waitForResponse) {
                addDialogueRecord(session, 'doctor', nextStep.content, {
                  phase: nextStep.phase,
                  guidance: nextStep.guidance
                });
                continueProcessing = false; // 需要用户输入，停止自动处理
              } else {
                addDialogueRecord(session, 'ai_analysis', nextStep.content, {
                  phase: nextStep.phase,
                  guidance: nextStep.guidance,
                  analysisType: 'systematic_analysis'
                });
              }
              
              // 添加下一个步骤
              session.consultationSteps.push({
                step: session.consultationSteps.length + 1,
                content: nextStep.content,
                type: nextStep.type,
                phase: nextStep.phase,
                guidance: nextStep.guidance,
                timestamp: new Date().toISOString(),
                aiReasoning: `AI医疗推理: ${nextStep.guidance}，转换理由: 基于临床信息完整性和医学逻辑进行智能阶段转换`,
                medicalPrompt: nextStep.medicalPrompt || MEDICAL_PROMPTS[nextStep.phase]
              });
              
              // 如果到达完成阶段，停止处理
              if (session.completed || nextStep.phase === DIAGNOSIS_PHASES.COMPLETED) {
                continueProcessing = false;
                // 如果是完成阶段，确保设置完成时间
                if (nextStep.phase === DIAGNOSIS_PHASES.COMPLETED && !session.completedAt) {
                  session.completedAt = new Date().toISOString();
                }
              }
            }
          } else if (!session.waitingForPatientResponse && thought) {
            // 记录医生深度分析
            addDialogueRecord(session, 'ai_analysis', thought, {
              phase: session.currentPhase,
              analysisType: 'doctor_deep_analysis',
              analysisLength: thought.length
            });
            
            // 医生的深度分析
            const currentStepIndex = session.consultationSteps.length - 1;
            if (currentStepIndex >= 0) {
              session.consultationSteps[currentStepIndex].doctorAnalysis = thought;
              
              // 保存特殊阶段的分析结果
              if (session.currentPhase === DIAGNOSIS_PHASES.DIAGNOSIS_FORMULATION) {
                session.finalDiagnosis = thought;
                addDialogueRecord(session, 'ai_analysis', `最终诊断确定: ${thought.substring(0, 100)}...`, {
                  phase: session.currentPhase,
                  milestone: 'final_diagnosis',
                  fullDiagnosis: thought
                });
              } else if (session.currentPhase === DIAGNOSIS_PHASES.TREATMENT_PLANNING) {
                session.treatmentPlan = thought;
                addDialogueRecord(session, 'ai_analysis', `治疗方案制定: ${thought.substring(0, 100)}...`, {
                  phase: session.currentPhase,
                  milestone: 'treatment_plan',
                  fullPlan: thought
                });
              }
            }
            
            // AI决定下一步，并自动处理所有非交互步骤
            let continueProcessing = true;
            let maxIterations = 10;
            let iterations = 0;
            
            while (continueProcessing && iterations < maxIterations) {
              iterations++;
              const currentPhase = session.currentPhase; // 保存当前阶段用于记录
              const nextStep = determineNextStep(session);
              
              if (!nextStep) {
                continueProcessing = false;
                break;
              }
              
              // 记录阶段转换决策
              addDialogueRecord(session, 'ai_reasoning', `完成${getPhaseDescription(currentPhase)}分析，转入${getPhaseDescription(nextStep.phase)}`, {
                completedPhase: currentPhase,
                nextPhase: nextStep.phase,
                transitionReason: nextStep.guidance,
                analysisComplete: true,
                iteration: iterations
              });
              
              session.waitingForPatientResponse = nextStep.waitForResponse;
              session.currentQuestion = nextStep.content;
              session.currentStepGuidance = nextStep.guidance;
              
              // 记录新步骤的内容
              if (nextStep.waitForResponse) {
                addDialogueRecord(session, 'doctor', nextStep.content, {
                  phase: nextStep.phase,
                  guidance: nextStep.guidance
                });
                continueProcessing = false; // 需要用户输入，停止自动处理
              } else {
                addDialogueRecord(session, 'ai_analysis', nextStep.content, {
                  phase: nextStep.phase,
                  guidance: nextStep.guidance,
                  analysisType: 'phase_analysis'
                });
              }
              
              session.consultationSteps.push({
                step: session.consultationSteps.length + 1,
                content: nextStep.content,
                type: nextStep.type,
                phase: nextStep.phase,
                guidance: nextStep.guidance,
                timestamp: new Date().toISOString(),
                aiReasoning: `AI医疗分析完成: ${getPhaseDescription(currentPhase)} → ${getPhaseDescription(nextStep.phase)}`,
                medicalPrompt: nextStep.medicalPrompt || MEDICAL_PROMPTS[nextStep.phase]
              });
              
              // 如果到达完成阶段，停止处理
              if (session.completed || nextStep.phase === DIAGNOSIS_PHASES.COMPLETED) {
                continueProcessing = false;
                // 如果是完成阶段，确保设置完成时间
                if (nextStep.phase === DIAGNOSIS_PHASES.COMPLETED && !session.completedAt) {
                  session.completedAt = new Date().toISOString();
                }
              }
            }
            
            // 如果已经完成，记录完成信息
            if (session.currentPhase === DIAGNOSIS_PHASES.COMPLETED) {
              addDialogueRecord(session, 'system', '诊断过程全部完成', {
                completedAt: new Date().toISOString(),
                totalSteps: session.consultationSteps.length,
                finalPhase: session.currentPhase,
                hasFullDiagnosis: !!session.finalDiagnosis,
                hasTreatmentPlan: !!session.treatmentPlan
              });
              
              session.completionAnalysis = `完整诊断流程已完成，共${session.consultationSteps.length}个步骤，包含${session.fullDialogueHistory.length}条对话记录`;
            }
          } else if (!session.waitingForPatientResponse && !thought) {
            // 系统分析阶段，自动循环处理所有非交互步骤
            let continueProcessing = true;
            let maxIterations = 10; // 防止无限循环
            let iterations = 0;
            
            while (continueProcessing && iterations < maxIterations) {
              iterations++;
              const currentPhase = session.currentPhase; // 保存当前阶段用于记录
              const nextStep = determineNextStep(session);
              
              if (!nextStep) {
                continueProcessing = false;
                break;
              }
              
              // 记录自动阶段转换
              addDialogueRecord(session, 'ai_reasoning', `系统自动转换: ${getPhaseDescription(currentPhase)} → ${getPhaseDescription(nextStep.phase)}`, {
                autoTransition: true,
                fromPhase: currentPhase,
                toPhase: nextStep.phase,
                reasoning: nextStep.guidance,
                iteration: iterations
              });
              
              session.waitingForPatientResponse = nextStep.waitForResponse;
              session.currentQuestion = nextStep.content;
              session.currentStepGuidance = nextStep.guidance;
              
              // 记录自动生成的步骤
              if (nextStep.waitForResponse) {
                addDialogueRecord(session, 'doctor', nextStep.content, {
                  phase: nextStep.phase,
                  guidance: nextStep.guidance,
                  autoGenerated: true
                });
                continueProcessing = false; // 需要用户输入，停止自动处理
              } else {
                addDialogueRecord(session, 'ai_analysis', nextStep.content, {
                  phase: nextStep.phase,
                  guidance: nextStep.guidance,
                  analysisType: 'auto_analysis',
                  autoGenerated: true
                });
              }
              
              session.consultationSteps.push({
                step: session.consultationSteps.length + 1,
                content: nextStep.content,
                type: nextStep.type,
                phase: nextStep.phase,
                guidance: nextStep.guidance,
                timestamp: new Date().toISOString(),
                aiReasoning: `系统自动推进: ${nextStep.guidance}`,
                medicalPrompt: nextStep.medicalPrompt || MEDICAL_PROMPTS[nextStep.phase],
                autoGenerated: true
              });
              
              // 如果到达完成阶段，停止处理
              if (session.completed || nextStep.phase === DIAGNOSIS_PHASES.COMPLETED) {
                continueProcessing = false;
                // 如果是完成阶段，确保设置完成时间
                if (nextStep.phase === DIAGNOSIS_PHASES.COMPLETED && !session.completedAt) {
                  session.completedAt = new Date().toISOString();
                }
              }
            }
            
            if (iterations >= maxIterations) {
              addDialogueRecord(session, 'system', '系统达到最大处理迭代次数，停止自动处理', {
                maxIterationsReached: true,
                finalPhase: session.currentPhase
              });
            }
          } else if (session.waitingForPatientResponse && !thought) {
            // 正在等待患者回答，返回当前状态
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
          session.summary = thought || "AI智能诊断过程已完成";
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

// 注册会话列表工具
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
      const dialogueCount = session.fullDialogueHistory ? session.fullDialogueHistory.length : 0;
      
      output += `**${id}** ${status}\n`;
      output += `📋 患者主诉: ${session.problem}\n`;
      output += `📊 诊断进度: ${session.consultationSteps.length} 个步骤\n`;
      output += `💬 对话记录: ${dialogueCount} 条\n`;
      output += `🎯 当前阶段: ${getPhaseDescription(session.currentPhase)}\n`;
      output += `⏰ 创建时间: ${new Date(session.createdAt).toLocaleString()}\n`;
      if (session.waitingForPatientResponse) {
        output += `🔴 等待患者回答\n`;
      }
      if (session.completed && session.completedAt) {
        output += `✅ 完成时间: ${new Date(session.completedAt).toLocaleString()}\n`;
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

// 注册完整对话历史查看工具
server.tool(
  "view_dialogue_history",
  "查看指定会话的完整对话历史，包括所有AI分析和推理过程",
  {
    sessionId: z.string().describe('要查看的会话ID'),
    includeMetadata: z.boolean().optional().default(false).describe('是否包含详细元数据')
  },
  async ({ sessionId, includeMetadata = false }) => {
    try {
      const session = loadSession(sessionId);
      if (!session) {
        return {
          content: [{
            type: "text",
            text: `❌ 未找到会话ID: ${sessionId}`
          }]
        };
      }
      
      let output = `🏥 **会话完整对话历史**\n`;
      output += `🆔 会话ID: ${sessionId}\n`;
      output += `📋 患者主诉: ${session.problem}\n`;
      output += `🎯 当前阶段: ${getPhaseDescription(session.currentPhase)}\n`;
      output += `📊 状态: ${session.completed ? '已完成' : '进行中'}\n`;
      output += `💬 总对话数: ${session.fullDialogueHistory ? session.fullDialogueHistory.length : 0}\n`;
      output += `📅 创建时间: ${new Date(session.createdAt).toLocaleString()}\n`;
      if (session.completed && session.completedAt) {
        output += `✅ 完成时间: ${new Date(session.completedAt).toLocaleString()}\n`;
      }
      output += `\n`;
      
      // 显示完整对话历史
      output += formatFullDialogueHistory(session);
      
      // 显示统计信息
      if (session.fullDialogueHistory) {
        const stats = {
          system: 0,
          doctor: 0,
          patient: 0,
          ai_analysis: 0,
          ai_reasoning: 0
        };
        
        session.fullDialogueHistory.forEach(record => {
          if (stats.hasOwnProperty(record.speaker)) {
            stats[record.speaker]++;
          }
        });
        
        output += `\n📊 **对话统计:**\n`;
        output += `🔧 系统消息: ${stats.system} 条\n`;
        output += `👨‍⚕️ 医生发言: ${stats.doctor} 条\n`;
        output += `👤 患者回答: ${stats.patient} 条\n`;
        output += `🤖 AI分析: ${stats.ai_analysis} 条\n`;
        output += `🧠 AI推理: ${stats.ai_reasoning} 条\n`;
      }
      
      return {
        content: [{
          type: "text",
          text: output
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ 查看对话历史时出错: ${error.message}`
        }]
      };
    }
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