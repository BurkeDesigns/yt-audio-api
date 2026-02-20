import { streamSSE, streamText } from 'hono/streaming'

// types
type Models = {
  uid?: number
  chat_id?: number
  system?: string
  model?: string
  prompt: string
  temperature?: number
  history?: any[]
  max_tokens?: number
};

const VLLM_BASE_URL = process.env.VLLM_BASE_URL || 'http://localhost:8000';


// benchmarking vLLM streaming chat completions
// source .venv/bin/activate
// vllm serve openai/gpt-oss-20b --gpu-memory-utilization 0.8 --async-scheduling
// vllm bench serve --model openai/gpt-oss-20b --base-url http://localhost:8000 --num-prompts 200 --request-rate inf --dataset-name random --random-input-len 128 --random-output-len 128 --num-warmups 20 --trust-remote-code --ignore-eos

export async function vLLM(options: Models) {
  const model = options.model || 'openai/gpt-oss-20b';
  // console.log("Streaming vLLM chat with model:", model);

  const response = await fetch(`${VLLM_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test',
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(options.history ?? []),
        { role: "user", content: options.prompt ?? 'Hi' }
      ],
      stream: false,
      max_tokens: options.max_tokens || 300,
      temperature: options.temperature || 0.6,
      // stream_options: { include_usage: true }
    }),
  });

  // console.log('Response status:', response.status);
  // console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('vLLM error response:', errorText);
    throw new Error(`vLLM returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  // console.log('vLLM response data:', data.choices);
  console.log('Usage:', data.usage);
  return data.choices?.[0]?.message?.content || '';

}