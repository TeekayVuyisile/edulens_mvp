import http from 'node:http';
import { afterAll, afterEach, beforeAll, describe, it, expect } from 'vitest';
import {
  activeProvider,
  AiNotConfiguredError,
  aiDescription,
  generateWorksheet,
  isConfigured,
} from '../../src/services/worksheets/generator.js';

// The real generator talks to a local stand-in for Groq/OpenAI, so the request
// the SDK sends (and how replies are read) is tested without a paid API.

const WORKSHEET = {
  title: 'Counting',
  instructions: 'Answer each question.',
  teacher_notes: 'Counting practice.',
  questions: [{ type: 'short_answer', prompt: 'What is 2 + 3?', options: [], pairs: [], answer: '5', marks: 1 }],
};

let server;
let baseURL;
const received = [];
let reply = () => ({ status: 200, content: JSON.stringify(WORKSHEET) });

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      const { status, content, error } = reply();
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify(
          error
            ? { error }
            : {
                id: 'x', object: 'chat.completion', created: 0, model: 'm',
                choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
                usage: { prompt_tokens: 10, completion_tokens: 5 },
              }
        )
      );
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}/openai/v1`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

afterEach(() => {
  for (const key of ['GROQ_API_KEY', 'GROQ_MODEL', 'GROQ_BASE_URL', 'AI_PROVIDER', 'AI_STRUCTURED_OUTPUT', 'OPENAI_API_KEY', 'OPENAI_BASE_URL']) {
    process.env[key] = '';
  }
  received.length = 0;
  reply = () => ({ status: 200, content: JSON.stringify(WORKSHEET) });
});

const request = {
  curriculumName: 'CAPS', subjectName: 'Mathematics', gradeLevel: '1', difficulty: 'easy',
  numberOfQuestions: 1, questionTypes: ['short_answer'], language: 'English',
};

const useGroq = () => {
  process.env.GROQ_API_KEY = 'gsk_test_not_a_real_key';
  process.env.GROQ_BASE_URL = baseURL;
};

describe('choosing the provider', () => {
  it('uses Groq when a Groq key is set, OpenAI otherwise, and AI_PROVIDER wins', () => {
    expect(activeProvider()).toBe('openai');
    process.env.GROQ_API_KEY = 'gsk_abcdefghijk';
    expect(activeProvider()).toBe('groq');
    process.env.AI_PROVIDER = 'openai';
    expect(activeProvider()).toBe('openai');
  });

  it('only counts real-looking keys for the active provider', () => {
    process.env.GROQ_API_KEY = 'your_groq_api_key_here';
    process.env.AI_PROVIDER = 'groq';
    expect(isConfigured()).toBe(false);
    process.env.GROQ_API_KEY = 'gsk_abcdefghijk';
    expect(isConfigured()).toBe(true);
    expect(aiDescription()).toEqual({ provider: 'Groq', model: 'llama-3.3-70b-versatile' });
  });
});

describe('generating through Groq', () => {
  it('sends JSON mode with the schema in the prompt, and reads the reply', async () => {
    useGroq();

    const result = await generateWorksheet(request);

    expect(result.worksheet.title).toBe('Counting');
    expect(result.model).toBe('groq/llama-3.3-70b-versatile');
    expect(result.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 });
    const [sent] = received;
    expect(sent.url).toBe('/openai/v1/chat/completions');
    expect(sent.auth).toBe('Bearer gsk_test_not_a_real_key');
    expect(sent.body.response_format).toEqual({ type: 'json_object' });
    expect(sent.body.messages[0].content).toContain('Reply with one JSON object only');
    expect(sent.body.messages[0].content).toContain('"teacher_notes"');
  });

  it('can use strict structured output for models that support it', async () => {
    useGroq();
    process.env.AI_STRUCTURED_OUTPUT = 'true';
    process.env.GROQ_MODEL = 'openai/gpt-oss-20b';

    await generateWorksheet(request);

    expect(received[0].body.model).toBe('openai/gpt-oss-20b');
    expect(received[0].body.response_format.type).toBe('json_schema');
  });

  it('accepts JSON wrapped in markdown fences, and retries once after an invalid reply', async () => {
    useGroq();
    let calls = 0;
    reply = () => {
      calls += 1;
      return { status: 200, content: calls === 1 ? '{"title": ""}' : '```json\n' + JSON.stringify(WORKSHEET) + '\n```' };
    };

    const result = await generateWorksheet(request);

    expect(calls).toBe(2);
    expect(result.worksheet.questions).toHaveLength(1);
  });

  it('reports a rejected key or an unknown model as a setup problem', async () => {
    useGroq();
    reply = () => ({ status: 401, error: { message: 'Invalid API Key', type: 'invalid_request_error' } });
    await expect(generateWorksheet(request)).rejects.toBeInstanceOf(AiNotConfiguredError);

    reply = () => ({ status: 404, error: { message: 'The model `old` does not exist', code: 'model_not_found' } });
    await expect(generateWorksheet(request)).rejects.toThrow(/set GROQ_MODEL/);
  });
});
