import assert from 'node:assert/strict';
import { createElement } from '../../frontend/node_modules/react';
import { act, create, type ReactTestRenderer } from '../../frontend/node_modules/react-test-renderer';

export function mountHook<Props, Result>(
  useHook: (props: Props) => Result,
  initialProps: Props
): {
  current: () => Result;
  rerender: (props: Props) => void;
  unmount: () => void;
} {
  let currentResult: Result | undefined;
  let renderer: ReactTestRenderer | null = null;

  function HookProbe({ hookProps }: { hookProps: Props }) {
    currentResult = useHook(hookProps);
    return null;
  }

  act(() => {
    renderer = create(createElement(HookProbe, { hookProps: initialProps }));
  });

  return {
    current: () => {
      assert.notEqual(currentResult, undefined, 'mounted hook should produce a result');
      return currentResult as Result;
    },
    rerender: (props) => {
      act(() => {
        renderer?.update(createElement(HookProbe, { hookProps: props }));
      });
    },
    unmount: () => {
      act(() => {
        renderer?.unmount();
      });
    },
  };
}
