import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const createAssistant = async ({
  name,
  instructions,
  fileId,
}: {
  name: string;
  instructions: string;
  fileId: any;
}) => {
  const assisstant = await openai.beta.assistants.create({
    name: name,
    instructions: instructions,
    tools: [],
    model: "gpt-4-1106-preview",
    file_ids: fileId && [fileId],
  });

  return assisstant;
};
