export interface SerialQueue {
  /** 追加任务;返回该任务的 Promise。前序任务失败不阻断后续任务 */
  add<T>(task: () => Promise<T>): Promise<T>
  /** 等待已入队任务全部结束(含失败) */
  onIdle(): Promise<void>
}

/** 串行队列:任务按提交顺序执行,识别大图时不阻塞 UI 线程逻辑编排 */
export function createSerialQueue(): SerialQueue {
  let tail: Promise<void> = Promise.resolve()

  return {
    add<T>(task: () => Promise<T>): Promise<T> {
      const run = tail.then(task, task)
      tail = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
    onIdle(): Promise<void> {
      return tail
    },
  }
}
