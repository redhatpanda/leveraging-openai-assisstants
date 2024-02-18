import { readDataStream } from "@/lib/read-data-stream";
import { AssistantStatus, Message } from "ai/react";
import { ChangeEvent, FormEvent, useState } from "react";

const roleToColorMap: Record<Message["role"], string> = {
  system: "lightred",
  user: "white",
  function: "lightblue",
  assistant: "lightgreen",
  data: "",
  tool: ""
};

export default function Assistant() {
  const prompt = "I want to make the next billion dollar product!";
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState<string>(prompt);
  const [threadId, setThreadId] = useState<string>("");
  const [error, setError] = useState<unknown | undefined>(undefined);
  const [status, setStatus] = useState<AssistantStatus>("awaiting_message");

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setStatus("in_progress");

    setMessages((messages: Message[]) => [
      ...messages,
      { id: "", role: "user" as "user", content: message! },
    ]);

    const formData = new FormData();
    formData.append("message", message as string);
    formData.append("threadId", threadId);

    const result = await fetch("/api/assistant", {
      method: "POST",
      body: formData,
    });

    if (result.body == null) {
      throw new Error("The response body is empty.");
    }

    try {
      for await (const { type, value } of readDataStream(
        result.body.getReader()
      )) {
        switch (type) {
          case "assistant_message": {
            setMessages((messages: Message[]) => [
              ...messages,
              {
                id: value.id,
                role: value.role,
                content: value.content[0].text.value,
              },
            ]);
            break;
          }
          case "assistant_control_data": {
            setThreadId(value.threadId);
            setMessages((messages: Message[]) => {
              const lastMessage = messages[messages.length - 1];
              lastMessage.id = value.messageId;
              return [...messages.slice(0, messages.length - 1), lastMessage];
            });
            break;
          }
          case "error": {
            setError(value);
            break;
          }
        }
      }
    } catch (error) {
      setError(error);
    }

    setStatus("awaiting_message");
  };

  const handleMessageChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  }

  return (
    <div>
      <h1>Assistant</h1>
      <form onSubmit={handleFormSubmit}>
        <input
          type="text"
          value={message}
          onChange={handleMessageChange}
        />
        <button type="submit">Send</button>
      </form>
      <div>
        {messages.map((message: Message, index: number) => (
          <div
            key={index}
            style={{
              backgroundColor: roleToColorMap[message.role],
              padding: "1rem",
              margin: "1rem",
            }}
          >
            {message.content}
          </div>
        ))}
      </div>
      <div>
        {status === "in_progress" && (
          <div>Processing...</div>
        )}
      </div>
    </div>
  );
}
