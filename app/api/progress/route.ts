import { getChatGPTUser } from "../../chatgpt-auth";
import {
  answerProgress, changeProgress, replaceProgress,
  resetProgress, seedProgress, setStudyLanguage, upgradeProgress,
} from "../../../db/progress";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "请先使用 ChatGPT 账号登录。" }, 401);
  try {
    const result = await changeProgress(user.userId, upgradeProgress);
    return json({ ...result.progress, revision: result.revision, account: user.email, accountId: user.userId });
  } catch (error) {
    console.error("Progress load failed", error);
    return json({ error: "云端进度暂时无法读取，请稍后重试。" }, 503);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "请先使用 ChatGPT 账号登录。" }, 401);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 6_000_000) return json({ error: "进度文件过大。" }, 413);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request");
    const type = body.type;
    if (!["seed", "answer", "replace", "reset", "language"].includes(String(type))) {
      return json({ error: "无法识别的同步操作。" }, 400);
    }
    const result = await changeProgress(user.userId, progress => {
      if (type === "seed") return seedProgress(progress, body);
      if (type === "answer") return answerProgress(progress, body);
      if (type === "replace") return replaceProgress(progress, body);
      if (type === "language") return setStudyLanguage(progress, body.language);
      return resetProgress(progress);
    });
    if (type === "answer") {
      return json({ record: result.progress.records[String(body.cardId)] || null,
        totalAnswers: result.progress.totalAnswers,
        generation: result.progress.generation,
        deviceSeq: result.progress.deviceSeq[String(body.deviceId)] || 0,
        revision: result.revision });
    }
    return json({ ...result.progress, revision: result.revision, account: user.email });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "进度数据格式无效。" }, 400);
    if (error instanceof Error && /Invalid|Too many|Missing earlier|reset on another/.test(error.message)) {
      return json({ error: error.message }, 409);
    }
    console.error("Progress save failed", error);
    return json({ error: "云端进度暂时无法保存，请稍后重试。" }, 503);
  }
}
