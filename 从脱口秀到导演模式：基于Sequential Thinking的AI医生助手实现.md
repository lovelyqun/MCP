# 让AI从话痨变成老中医：连续对话的实现秘密

源码：https://github.com/x-ai/sequential-thinking
当我想让AI像医生一样问诊时，发现它总是忘记前面说啥，或者问完一个问题就停不下来。

传统AI交互模式：

🧑‍💻 "我肚子疼。"
🤖 "好的，肚子疼可能是...，需要进一步检查...,建议你做...检查 巴拉巴拉..."

看似说了很多，其实啥也没说。🤦‍♂️

显然不行。所以我做了个实验——让AI学会"连续思考"，像真正的专家一样**有条理地**引导整个对话。今天就来聊聊这个有趣的**Sequential Thinking**实现。

## 🔄 老式AI vs 新式AI：差别在哪？

### 老式AI：像个"金鱼"🐟
```javascript
// 天气查询 - 典型的金鱼记忆
server.tool("get_weather", {city}, async ({city}) => {
  const weather = generateWeatherData(city);
  return formatWeatherInfo(weather); // 说完就忘，下次重来
});
```

**金鱼特色：** 
- 七秒记忆，每次都是新朋友
- 问一句答一句，绝不多想
- 简单粗暴，适合查个天气啥的

### 新式AI：像个"老中医"👨‍⚕️
```javascript
// 医生助手 - 步步为营，环环相扣
server.tool("assistant-doctor", {sessionId, thought, action}, async (params) => {
  const session = loadOrCreateSession(params); // 翻出病历本
  
  if (session.waitingForPatientResponse) {
    return "WAITING_FOR_USER_INPUT"; // 闭嘴，听病人说话
  }
  
  // 下一步该问啥，心里有数
  const nextStep = getNextDiagnosisStep(session);
  return formatGuidedQuestion(nextStep);
});
```

**老中医特色：**
- 记性好，你昨天说啥都记得
- 有章法，按套路出牌
- 会主动，该问啥就问啥

## 🏥 让AI变身老中医：实战案例解析

看病这事儿，是个技术活。医生不会上来就给你开药，而是要：
1. 👂 听你描述哪里不舒服（主诉）
2. 🔍 追问细节："怎么个疼法？" （症状详询）  
3. 📋 了解病史："以前得过啥病？"（病史采集）
4. 🩺 看看检查结果（体格检查）
5. 🧠 综合分析，给出诊断

这是一套标准动作，不能乱。传统AI就像个莽撞的实习医生🩺👶，想到哪说到哪。而我们的Sequential Thinking MCP就是要让AI变身**老中医**👨‍⚕️✨，有条不紊地问诊。

### 三大法宝，让AI变聪明

#### 法宝一：给AI一个"问诊清单"📋
```javascript
function getMedicalDiagnosisSteps() {
  return [
    {
      type: "question",
      content: "今天哪里不舒服？啥时候开始的？",
      waitForResponse: true,
      responseKey: "chief_complaint"
    },
    {
      type: "question", 
      content: "具体咋疼的？刺痛还是胀痛？",
      waitForResponse: true,
      responseKey: "symptom_details"
    },
    // ... 还有好几步，一步都不能少
  ];
}
```

#### 法宝二：给AI一个"病例本"📝
```javascript
const session = {
  id: "medical_xxx",           // 病历号
  problem: "肩膀疼",           // 主要毛病
  currentStep: 3,              // 现在问到第几个问题了
  totalSteps: 7,               // 总共要问几个
  waitingForPatientResponse: true,  // 是不是在等病人说话
  consultationSteps: [],       // 完整的问诊记录
  patientResponses: {}         // 病人说过的话，分类记好
};
```

#### 法宝三：教AI啥时候该说话，啥时候该闭嘴
```javascript
// 简单粗暴的逻辑
if (病人刚说完话 && 有新信息) {
  把话记到小本本上();
  翻到下一页();
  
  if (下一个问题需要病人回答) {
    return "闭嘴，等病人说话";
  }
} else {
  继续按流程走();
}
```

## 🧠 揭秘：三个小技巧让AI变得有耐心

### 技巧一：教AI学会"打住！等等！"

你知道最难的是什么吗？让AI闭嘴！传统AI就像话痨，一开口就停不下来。但老中医问诊时，问完一个问题就得等病人回答，不能自说自话。

```javascript
// 这招太绝了：给AI下个"禁言令"
if (session.waitingForPatientResponse) {
  return `
⚠️ 暂停！现在轮到病人说话了
👨‍⚕️ 刚才问的是: ${session.currentQuestion}
💡 AI你别抢话，等等真人回答
--- 此处必须停止，等待真实用户输入 ---
  `;
}
```

**这招咋管用的：**
- AI看到这个"禁言令"，立马闭嘴
- 病人说完话，才能继续下一轮
- 简单粗暴，但效果拔群

### 技巧二：给AI配个"超级大脑"

还记得那个七秒记忆的金鱼吗？我们得给AI换个脑子！这个新脑子不但记性好，还很有条理。

```javascript
// AI的新大脑长这样：
const session = {
  id: "medical_xxx",
  currentStep: 3,                    // 问到第几个问题了
  totalSteps: 7,                     // 总共要问几个
  waitingForPatientResponse: true,   // 现在是不是该病人说话
  consultationSteps: [               // 完整的聊天记录
    {
      step: 1,
      content: "哪里不舒服？",
      patientResponse: "肩膀疼，疼了一个月了",
      timestamp: "2025-01-01T10:00:00Z"
    },
    // ... 每一轮对话都记得清清楚楚
  ],
  patientResponses: {                // 重要信息分类整理
    "chief_complaint": "肩膀疼，疼了一个月了",
    "symptom_details": "胀痛，上班时特别严重"
  }
};
```

**这脑子有多厉害：**
- 每次对话都会翻出完整的病历
- 病人说过的每句话都记着
- 能根据前面的信息，越问越深入

### 技巧三：给AI写个"作弊小抄"

最后一招是关键！就像考试时偷偷带小抄一样，我们给AI准备了一个问诊流程表，按着这个来，保准不会乱套。

```javascript
// AI的问诊小抄
function getMedicalDiagnosisSteps() {
  return [
    {
      type: "question",
      content: "哪里不舒服？啥时候开始的？",
      waitForResponse: true,  // 这里要等病人回答
      responseKey: "chief_complaint"
    },
    {
      type: "question", 
      content: "具体咋疼的？什么情况下疼得厉害？",
      waitForResponse: true,  // 这里也要等
      responseKey: "symptom_details"
    },
    {
      type: "analysis",
      content: "让我琢磨琢磨你这症状...",
      waitForResponse: false  // 这里AI自己分析，不用等
    }
    // ... 照着这个流程一步步来
  ];
}

// AI按小抄办事
function processNextStep(session, userInput) {
  const 当前步骤 = getMedicalDiagnosisSteps()[session.currentStep - 1];
  
  if (需要等病人说话 && 病人刚说了话) {
    记到小本本上(userInput);
    翻页到下一步();
  } else if (该AI自己琢磨了) {
    开始分析();
    继续下一步();
  }
  
  return 问下一个问题();
}
```

**小抄的威力：**
- AI不能胡说八道，必须按流程来
- 每一步都有明确任务，不会跑偏
- 自动判断啥时候该闭嘴，啥时候该分析

## 🛠️ 代码实现：五分钟看懂精髓

### 怎么注册这个神奇的工具
```javascript
server.tool(
  "assistant-doctor",           // 工具名，简单粗暴
  "AI老中医问诊助手",          // 描述，一目了然
  {
    problem: "病人主要毛病",    // 比如"肩膀疼"
    thought: "刚才说了啥",      // 病人的回答或AI的分析
    sessionId: "病历号",        // 用来找到对应的聊天记录
    action: "干啥"              // 开始、继续、还是结束
  },
  async (参数) => {
    // 根据不同情况，做不同的事
    switch (参数.action) {
      case 'start':   return 开始问诊(参数.problem);
      case 'continue': return 继续问诊(参数.sessionId, 参数.thought);
      case 'complete': return 结束问诊(参数.sessionId);
    }
  }
);
```

### 跟普通工具有啥区别？

**普通工具（比如天气查询）：**
```javascript
🧑‍💻："北京天气咋样？"
🤖："晴天，25度。" // 说完就完事，没有下文 🔚
```

**我们的Sequential Thinking工具：**
```javascript
👨‍⚕️ AI："哪里不舒服？"
🤒 你："肩膀疼"
👨‍⚕️ AI："咋疼的？刺痛还是胀痛？"
🤒 你："胀痛，上班时厉害"
👨‍⚕️ AI："那让我再问问你的病史..."
// 一步步深入，像真正的医生 🎯
```

## 🎯 这玩意儿到底有啥用？

### 解决了AI的三大老毛病

1. **健忘症晚期** 🧠🔥
   - 以前：每次对话都要重新介绍自己，累人 😰
   - 现在：AI有了好记性，聊过的都记得 📚✨

2. **没有章法** 🤯
   - 以前：用户得当导演，告诉AI下一步该干啥 🎬👀
   - 现在：AI自己就是导演，按流程办事 🎯📝

3. **太被动** 😴
   - 以前：你不问我不说，典型社恐 🙈
   - 现在：AI会主动问问题，像个话痨（但是有用的话痨）💬✨

### 还能用在哪些地方？

- **各种咨询**：看病问诊、法律咨询、心理疏导
- **教学相关**：一对一辅导、技能培训、考试评估
- **商务流程**：客户访谈、需求调研、项目策划  
- **决策帮助**：风险分析、方案评估、问题诊断

基本上，只要是需要"一步步深入了解"的场景，都能用上这招。

## 🔮 最后说两句

**让AI学会了"耐心"** —— 该等你说话时就等着，该自己思考时就思考，不抢话，不乱套。这可比那些话痨AI强多了！

