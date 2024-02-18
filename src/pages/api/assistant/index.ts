import { experimental_AssistantResponse } from "ai";
import OpenAI from "openai";
import { MessageContentText } from "openai/resources/beta/threads/messages/messages";
import { NextRequest } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ,
});

export const runtime = "edge";

export default async function POST(req: NextRequest) {
  const input = await req.formData();

  const threadId = Boolean(input.get("threadId"))
    ? (input.get("threadId") as string)
    : (await openai.beta.threads.create()).id;

  const messageData = {
    role: "user" as "user",
    content: input.get("message") as string,
    file_ids: undefined,
  };

  const createdMessage = await openai.beta.threads.messages.create(
    threadId,
    messageData
  );

  return experimental_AssistantResponse(
    { threadId, messageId: createdMessage.id },
    async ({ threadId, sendMessage }) => {
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id:
          process.env.OPENAI_ASSISTANT_ID ??
          (() => {
            throw new Error("OPENAI_ASSISTANT_ID is not set");
          })(),
      });
      async function waitForRun(
        run: OpenAI.Beta.Threads.Runs.Run
      ): Promise<void> {
        while (run.status === "queued" || run.status === "in_progress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          run = await openai.beta.threads.runs.retrieve(threadId, run.id);
        }

        if (
          run.status === "cancelled" ||
          run.status === "cancelling" ||
          run.status === "failed" ||
          run.status === "expired"
        ) {
          throw new Error(run.status);
        }
      }

      await waitForRun(run);

      const responseMessages = (
        await openai.beta.threads.messages.list(threadId, {
          after: createdMessage.id,
          order: "asc",
        })
      ).data;

      for (const message of responseMessages) {
        sendMessage({
          id: message.id,
          role: "assistant",
          content: message.content.filter(
            (content) => content.type === "text"
          ) as Array<MessageContentText>,
        });
      }
    }
  );
}
