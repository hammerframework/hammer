import * as tsm from 'ts-morph'
import { ts } from 'ts-morph'

/**
 * Creates a ResolutionHostFactory that *extends* the search logic to include the Dirname convention.
 * (It adds one extra step on top of the built-in resolution algorithm)
 *
 * It also filters out any external library imports (this prevents ts-morph from processing potentially hundreds of files)
 */
export function tsm_ResolutionHostFactory_withDirnameConvention(): tsm.ResolutionHostFactory {
  return (moduleResolutionHost /*, getCompilerOptions*/) => {
    return {
      resolveModuleNames: (
        moduleNames,
        containingFile,
        _2,
        _3,
        compilerOptions
      ) => {
        // const compilerOptions = getCompilerOptions()
        return (
          moduleNames
            .map(resolve)
            // we don't want to load anything in node_modules (for performance)
            .map((x) => (x?.isExternalLibraryImport ? undefined : x))
        )
        function resolve(moduleName: string) {
          const r1 = ts_resolve(moduleName)
          if (r1) return r1
          // repeat the last segment (this is a naive directorynamed convention impl)
          const parts = moduleName.split('/')
          const moduleName2 = [...parts, parts[parts.length - 1]].join('/')
          return ts_resolve(moduleName2)
        }
        function ts_resolve(moduleName: string) {
          return ts.resolveModuleName(
            moduleName,
            containingFile,
            compilerOptions,
            moduleResolutionHost
          ).resolvedModule
        }
      },
    }
  }
}
