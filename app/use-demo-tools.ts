'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
type State = {
  entered: boolean;
  school: string;
  saved: number[];
  activities: { id: number; title: string; fits: boolean }[];
  save: (id: number) => void;
};
export function useDemoTools(state: State) {
  const current = useRef(state);
  useLayoutEffect(() => {
    current.current = state;
  });
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: 'read_demo_activities',
        description:
          'Read school-scoped example activities, timetable compatibility and saved IDs in the current demo. Requires entering the demo; this is not real university data.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => {
          const s = current.current;
          if (!s.entered) throw new Error('Enter a school demo first.');
          return { school: s.school, activities: s.activities, saved: s.saved };
        },
      },
      {
        name: 'save_demo_activity',
        description:
          'Save an example activity to the current in-memory demo schedule. Does not apply to the real event or send notifications.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'integer' } },
          required: ['id'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input) => {
          const s = current.current;
          const id = (input as { id?: unknown })?.id;
          if (!s.entered) throw new Error('Enter a school demo first.');
          if (
            typeof id !== 'number' ||
            !Number.isInteger(id) ||
            !s.activities.some((a) => a.id === id)
          )
            throw new Error('Unknown activity ID.');
          if (!s.saved.includes(id)) flushSync(() => s.save(id));
          return { id, saved: current.current.saved.includes(id) };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Unsupported experimental API must not affect the demo. */
      }
    }
    return () => lifecycle.abort();
  }, []);
}
