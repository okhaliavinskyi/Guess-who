import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScreenWakeLock } from '../src/hooks/useScreenWakeLock.ts';
import { FakeSentinel, installWakeLock, removeWakeLock, setVisibility } from './wakeLockMock.ts';

afterEach(() => {
  removeWakeLock();
  setVisibility('visible');
});

describe('useScreenWakeLock', () => {
  it('reports unsupported when navigator.wakeLock is absent', async () => {
    removeWakeLock();
    const { result } = renderHook(({ on }) => useScreenWakeLock(on), {
      initialProps: { on: true },
    });
    await act(() => result.current.requestFromGesture());
    expect(result.current.status).toBe('unsupported');
  });

  it('acquires from the gesture, coalesces concurrent requests, releases when disabled', async () => {
    const { request, sentinels } = installWakeLock();
    const { result, rerender } = renderHook(({ on }) => useScreenWakeLock(on), {
      initialProps: { on: false },
    });
    await act(async () => {
      void result.current.requestFromGesture();
      void result.current.requestFromGesture();
      rerender({ on: true });
    });
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');

    rerender({ on: false });
    await waitFor(() => expect(result.current.status).toBe('released'));
    expect(sentinels[0]?.release).toHaveBeenCalled();
  });

  it('reports denied on rejection without an unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    installWakeLock(() => Promise.reject(new DOMException('nope', 'NotAllowedError')));
    const { result } = renderHook(() => useScreenWakeLock(true));
    await act(() => result.current.requestFromGesture());
    await waitFor(() => expect(result.current.status).toBe('denied'));
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('handles system release and re-acquires when the page becomes visible again', async () => {
    const { request, sentinels } = installWakeLock();
    const { result } = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(result.current.status).toBe('active'));

    act(() => {
      setVisibility('hidden');
      sentinels[0]?.revoke();
    });
    expect(result.current.status).toBe('released');

    await act(async () => setVisibility('visible'));
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not request while hidden', async () => {
    const { request } = installWakeLock();
    setVisibility('hidden');
    const { result } = renderHook(() => useScreenWakeLock(true));
    await act(() => result.current.requestFromGesture());
    expect(request).not.toHaveBeenCalled();
  });

  it('never re-acquires after play ends, and releases on unmount', async () => {
    const { request, sentinels } = installWakeLock();
    const { result, rerender, unmount } = renderHook(({ on }) => useScreenWakeLock(on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(result.current.status).toBe('active'));
    rerender({ on: false });
    await act(async () => {
      setVisibility('hidden');
      setVisibility('visible');
    });
    expect(request).toHaveBeenCalledTimes(1);

    rerender({ on: true });
    await waitFor(() => expect(result.current.status).toBe('active'));
    unmount();
    expect(sentinels[1]?.release).toHaveBeenCalled();
  });

  it('releases a lock that resolves after play already ended', async () => {
    let resolve!: (s: FakeSentinel) => void;
    installWakeLock(() => new Promise((r) => (resolve = r)));
    const { result, rerender } = renderHook(({ on }) => useScreenWakeLock(on), {
      initialProps: { on: true },
    });
    rerender({ on: false });
    const late = new FakeSentinel();
    await act(async () => resolve(late));
    expect(late.release).toHaveBeenCalled();
    expect(result.current.status).toBe('released');
  });
});
