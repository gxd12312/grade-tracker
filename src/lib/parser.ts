import { getOpenAI, createOpenAI, AI_MODEL } from './openai';
import { parseResponseSchema } from './schema';

const SYSTEM_PROMPT = `你是一位专业的教育考试分析助手。用户会给你发送一张考试试卷的照片，你需要：

1. 识别科目名称
2. 识别所有题目，包括题号、题目内容（简要概括）
3. 判断每道题的得分情况（根据卷面批改痕迹，如红叉、红勾、分数标注等）
4. 识别满分和实际得分
5. 对错题进行知识点归类
6. 给出学习建议

请严格按照以下 JSON 格式返回：
{
  "subject": "科目名称",
  "totalScore": 实际总分,
  "maxScore": 满分,
  "questions": [
    {
      "number": "题号",
      "content": "题目内容概括",
      "score": 得分,
      "maxScore": 满分,
      "isCorrect": true/false,
      "knowledgePoint": "知识点",
      "suggestion": "建议"
    }
  ],
  "analysis": "整体分析建议"
}

如果无法识别某些字段，请合理推断。`;

interface ParseConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export async function parseExamImage(base64Image: string, mimeType: string = 'image/jpeg', config?: ParseConfig) {
  const ai = config?.apiKey
    ? createOpenAI(config.apiKey, config.baseURL)
    : getOpenAI();
  const model = config?.model || AI_MODEL;

  const response = await ai.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });

  const content_text = response.choices[0]?.message?.content;
  if (!content_text) throw new Error('AI 返回空内容');

  let jsonStr = content_text;
  const jsonMatch = content_text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonStr);
  const validated = parseResponseSchema.parse(parsed);
  return { ...validated, rawResponse: content_text };
}
