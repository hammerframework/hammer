import * as tsm from 'ts-morph'

import { tsm_ResolutionHostFactory_withDirnameConvention } from './tsm_ResolutionHostFactory_withDirnameConvention'

/**
 * - extends the resolution logic to include the Dirname convention
 */
export function tsm_Project_redwoodFriendly(
  tsConfigFilePath: string,
  addFilesFromTsConfig = false
) {
  return new tsm.Project({
    tsConfigFilePath,
    compilerOptions: {
      skipLibCheck: true,
      noLib: true,
      disableReferencedProjectLoad: true,
      composite: true,
      incremental: true,
      noEmit: true,
      declaration: false,
      lib: [],
      types: [],
    },
    addFilesFromTsConfig,
    resolutionHost: tsm_ResolutionHostFactory_withDirnameConvention(),
  })
}
