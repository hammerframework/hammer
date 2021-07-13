import { PostgrestClient } from '@supabase/postgrest-js'
import ci from 'ci-info'
import envinfo from 'envinfo'

import { getConfig } from './config'
import { getPaths } from './paths'

// circular dependency when trying to import @redwoodjs/structure so lets do it
// the old fashioned way
const { DefaultHost } = require('../../structure/dist/hosts')
const { RWProject } = require('../../structure/dist/model/RWProject')

interface SensitiveArgPositions {
  exec: {
    positions: Array<number>
    redactWith: string
  }
  g: {
    positions: Array<number>
    redactWith: string
  }
  generate: {
    positions: Array<number>
    redactWith: string
  }
}

// Tracks any commands that could contain sensative info and their position in
// the argv array, as well as the text to replace them with
const SENSITIVE_ARG_POSITIONS: SensitiveArgPositions = {
  exec: {
    positions: [1],
    redactWith: '[script]',
  },
  g: {
    positions: [2],
    redactWith: '[name]',
  },
  generate: {
    positions: [2],
    redactWith: '[name]',
  },
}

// gets diagnostic info and sanitizes by removing references to paths
const getInfo = async () => {
  const info = JSON.parse(
    await envinfo.run(
      {
        System: ['OS', 'Shell'],
        Binaries: ['Node', 'Yarn', 'npm'],
        npmPackages: '@redwoodjs/*',
        IDEs: ['VSCode'],
      },
      { json: true }
    )
  )

  // get shell name instead of path
  if (info.System.Shell.path.match('/')) {
    info.System.Shell.name = info.System.Shell.path.split('/').pop()
  } else if (info.System.Shell.path.match('\\')) {
    info.System.Shell.name = info.System.Shell.path.split('\\').pop()
  }

  return {
    os: info.System.OS.split(' ')[0],
    osVersion: info.System.OS.split(' ')[1],
    shell: info.System.Shell.name,
    nodeVersion: info.Binaries.Node.version,
    yarnVersion: info.Binaries.Node.version,
    npmVersion: info.Binaries.Node.version,
    vsCodeVersion: info.IDEs.VSCode.version,
    redwoodVersion: info.npmPackages['@redwoodjs/core'].installed,
  }
}

// removes potentially sensative information from an array of argv strings
const sanitizeArgv = (argv: Array<string>) => {
  const args = argv.slice(2)
  const name = args[0]
  const sensativeCommand =
    SENSITIVE_ARG_POSITIONS[name as keyof SensitiveArgPositions]

  if (sensativeCommand) {
    sensativeCommand.positions.forEach((pos: number) => {
      args[pos] = sensativeCommand.redactWith
    })
  }

  return args.join(' ')
}

// wrap a function in this call to get a telemetry hit including how long it took
export const timedTelemetry = async (
  argv: Array<string>,
  func: (...args: any[]) => any
) => {
  const start = new Date()
  const result = await func.call(this)
  const duration = new Date().getTime() - start.getTime()

  await telemetry(argv, { duration })

  return result
}

// used as yargs middleware when any command is invoked
export const telemetryMiddleware = async () => {
  await telemetry(process.argv)
}

// command that actually sends prepared data to telemetry collection service
export const telemetry = async (
  argv: Array<string>,
  input: Record<string, unknown> = {}
) => {
  if (process.env.REDWOOD_DISABLE_TELEMETRY || process.env.DO_NOT_TRACK) {
    return
  }

  try {
    const project = new RWProject({
      projectRoot: getPaths().base,
      host: new DefaultHost(),
    })

    const payload = {
      type: input.type || 'command',
      command: sanitizeArgv(argv),
      ci: ci.isCI,
      duration: input.duration,
      nodeEnv: process.env.NODE_ENV || null,
      routeCount: project.getRouter().routes.length,
      serviceCount: project.services.length,
      sides: project.sides.join(','),
      ...(await getInfo()),
    }

    const telemetryConfig = getConfig().telemetry

    const postgrest = new PostgrestClient(telemetryConfig.url, {
      headers: {
        apikey: telemetryConfig.apikey,
      },
      schema: 'public',
    })

    const { error } = await postgrest.from('events').insert(payload)

    // TODO: remove this before merging for real
    if (error) {
      console.error('Error from telemetry insert:', error)
    }
  } catch (e) {
    // service interruption: network down or telemetry API not responding
    // don't let telemetry errors bubble up to user, just do nothing
    console.error('Uncaught error in telemetry:', e)
  }
}
