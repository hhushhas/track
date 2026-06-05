'use node'

import { Box, type BoxSize, type NetworkPolicy, type Runtime } from '@upstash/box'

export type BoxRuntime = Extract<Runtime, 'node' | 'python' | 'golang' | 'ruby' | 'rust'>
export type MemoryBoxStatus = 'creating' | 'ready' | 'paused' | 'error' | 'deleted'

export type BoxExecResult = {
  commandId: string
  exitCode: number | null
  status: string
  stdout: string
  durationMs: number
}

export type MemoryBoxAdapter = {
  create(input: {
    name: string
    runtime: BoxRuntime
    size: BoxSize
    networkPolicy: NetworkPolicy
  }): Promise<{ boxId: string }>
  delete(boxId: string): Promise<void>
  ensureDirectories(boxId: string, paths: Array<string>): Promise<void>
  getStatus(boxId: string): Promise<{ status: MemoryBoxStatus | string }>
  readFile(boxId: string, path: string): Promise<string>
  writeFile(boxId: string, path: string, content: string): Promise<void>
  exec(boxId: string, input: { command: string; cwd?: string }): Promise<BoxExecResult>
}

export function createLiveMemoryBoxAdapter(): MemoryBoxAdapter {
  return new LiveMemoryBoxAdapter()
}

class LiveMemoryBoxAdapter implements MemoryBoxAdapter {
  async create(input: {
    name: string
    runtime: BoxRuntime
    size: BoxSize
    networkPolicy: NetworkPolicy
  }) {
    const box = await Box.create({
      keepAlive: false,
      name: input.name,
      networkPolicy: input.networkPolicy,
      runtime: input.runtime,
      size: input.size,
    })
    return { boxId: box.id }
  }

  async delete(boxId: string) {
    const box = await this.getBox(boxId)
    await box.delete()
  }

  async ensureDirectories(boxId: string, paths: Array<string>) {
    if (paths.length === 0) return
    await this.exec(boxId, {
      command: `mkdir -p ${paths.map(shellQuote).join(' ')}`,
    })
  }

  async getStatus(boxId: string) {
    const box = await this.getBox(boxId)
    return await box.getStatus()
  }

  async readFile(boxId: string, path: string) {
    const box = await this.getBox(boxId)
    return await box.files.read(path)
  }

  async writeFile(boxId: string, path: string, content: string) {
    const box = await this.getBox(boxId)
    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    if (parent) {
      await this.ensureDirectories(boxId, [parent])
    }
    await box.files.write({ path, content })
  }

  async exec(boxId: string, input: { command: string; cwd?: string }) {
    const box = await this.getBox(boxId)
    const startedAt = Date.now()
    const command = input.cwd
      ? `cd ${shellQuote(input.cwd)} && ${input.command}`
      : input.command
    const run = await box.exec.command(command)
    return {
      commandId: run.id,
      durationMs: Date.now() - startedAt,
      exitCode: run.exitCode,
      status: run.status,
      stdout: run.result,
    }
  }

  private async getBox(boxId: string) {
    return await Box.get(boxId)
  }
}

export class FakeMemoryBoxAdapter implements MemoryBoxAdapter {
  private boxes = new Map<string, { deleted: boolean; files: Map<string, string>; status: MemoryBoxStatus }>()
  private nextId = 1

  async create(_input?: {
    name: string
    runtime: BoxRuntime
    size: BoxSize
    networkPolicy: NetworkPolicy
  }) {
    const boxId = `fake_box_${this.nextId++}`
    this.boxes.set(boxId, { deleted: false, files: new Map(), status: 'ready' })
    return { boxId }
  }

  async delete(boxId: string) {
    const box = this.get(boxId)
    box.deleted = true
    box.status = 'deleted'
  }

  async ensureDirectories(_boxId?: string, _paths?: Array<string>) {
    return
  }

  async getStatus(boxId: string) {
    return { status: this.get(boxId).status }
  }

  async readFile(boxId: string, path: string) {
    const content = this.get(boxId).files.get(path)
    if (content === undefined) throw new Error(`file_not_found:${path}`)
    return content
  }

  async writeFile(boxId: string, path: string, content: string) {
    this.get(boxId).files.set(path, content)
  }

  async exec(boxId: string, input: { command: string; cwd?: string }) {
    this.get(boxId)
    return {
      commandId: `fake_run_${Date.now()}`,
      durationMs: 1,
      exitCode: 0,
      status: 'completed',
      stdout: `fake exec${input.cwd ? ` in ${input.cwd}` : ''}: ${input.command}`,
    }
  }

  seedFile(boxId: string, path: string, content: string) {
    this.get(boxId).files.set(path, content)
  }

  getFile(boxId: string, path: string) {
    return this.get(boxId).files.get(path)
  }

  private get(boxId: string) {
    const box = this.boxes.get(boxId)
    if (!box || box.deleted) throw new Error(`box_not_found:${boxId}`)
    return box
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}
