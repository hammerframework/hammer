/**
 * This is the master list of diagnostic codes and metadata.
 *
 * Be extra mindful when adding new keys. These keys are used as error codes
 * and, once published, they might be referenced by docs, issues, etc
 * and can't be changed.
 *
 * the alias mechanism provides a way around this, but it should not be overused.
 */
export const diagnosticCodes = defCodes({
  invalid_route_path_syntax: {
    message: 'Invalid Route Path Syntax',
    doc: 'https://redwoodjs.com/docs/redwood-router#route-parameters',
    category: 'router',
  },
  notfound_cannot_be_private: {
    message: 'The Not Found route cannot be private',
    category: 'router',
  },
  every_project_must_have_schema_prisma: {
    message: 'Every Redwood project must have a schema.prisma file',
    doc: 'https://redwoodjs.com/docs/schema-relations',
  },
  schema_prisma_not_ok: {
    aliasFor: 'every_project_must_have_schema_prisma',
  },
})

function defCodes<
  D extends DiagnosticProps | AliasProps,
  T extends Record<string, D>
>(x: T): { [K in keyof T]: DiagnosticProps & { code: K } } {
  return x as any
}

const categoryCodes = {
  router: 'Router',
  prisma: 'Prisma',
}

type CategoryCode = keyof typeof categoryCodes

interface DiagnosticProps {
  message: string
  doc?: string
  category?: CategoryCode
}

interface AliasProps {
  aliasFor: string
}
