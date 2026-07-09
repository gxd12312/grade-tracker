const fs = require('fs');
const path = require('path');

const ws = process.argv[2];
if (!ws) { console.error('Usage: node fix.js <workspace>'); process.exit(1); }

function write(relPath, content) {
  const fullPath = path.join(ws, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Written:', relPath, '(' + content.length + ' chars)');
}

// parser.ts with types
write('src/lib/parser.ts', import { openai } from './openai';
import { parseResponseSchema } from './schema';

const SYSTEM_PROMPT = \浣犳槸涓€浣嶉暱涓氱殑鏁欒偛鑰冭瘯鍒嗘瀽鍔╂墜銆備娇鐢ㄦ埛浼氱粰浣犲彂閫佷竴寮犺€冭瘯璇曞嵎鐨勭収鐗囷紝浣犻渶瑕侊細

1. 璇嗗埆绉戠洰鍚嶇О
2. 璇嗗埆鎵€鏈夐鐩紝鍖呮嫭棰樺彿銆侀銆侀鐩唀鍐呭鍐呭锛堢畝瑕佹揩鎀烩級
3. 鍒ゆ柇姣忛亾棰樺緱鍒嗘儏鍐碉紙鏍规嵁鍗扮増鎵逛慨鐥滆氨杈癸紝濡備孩鍙娿€佺孩鍕掋€佸垎鏁版爣娉㈢瓑锛?4. 璇嗗埆婊″垎鍜屽疄闄呭緱鍒?5. 澶ч敊棰橈紝鍑嗗璇嗗埆鐭簣
6. 缁欏嚭瀛涜寤鸿

璇锋牸閫傚凹鎷﹁鐨?JSON 鏍煎紡锛?{
  "subject": "绉戠洰鍚嶇О",
  "totalScore": 瀹炲喌鎬诲垎,
  "maxScore": 婊″垎,
  "questions": [
    {
      "number": "棰樺彿",
      "content": "棰樺喌鍐呭鎬敾",
      "score": 寰楀垎,
      "maxScore": 婊″垎,
      "isCorrect": false,
      "knowledgePoint": "鐭"鐭簣鐐?,
      "suggestion": "寤鸿"
    }
  ],
  "analysis": "鏁村垎鏋滃缓璁?
}

濡傛灉鏃犳硶璇嗗埆鏌愪簺瀛楁锛岃鍚堢悊鎺ㄦ柇銆?);

export async function parseExamImage(base64Image: string, mimeType: string = 'image/jpeg') {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: \data:\;base64,\\,
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
  if (!content_text) throw new Error('AI 杩斿洖绌哄唴瀹?);

  let jsonStr = content_text;
  const jsonMatch = content_text.match(/\{[\\s\\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonStr);
  return parseResponseSchema.parse(parsed);
}
);