interface BuildOptions {
  watch: boolean
  rebuild: boolean
}

export const build: ({ watch }?: BuildOptions) => Promise<any>
