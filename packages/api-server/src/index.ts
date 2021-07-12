#!/usr/bin/env node
import yargs from 'yargs'

import { apiCliOptions, apiServerHandler } from './handler'

apiServerHandler(yargs.options(apiCliOptions).argv)
